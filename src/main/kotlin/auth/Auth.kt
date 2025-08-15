package com.batr.auth

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.client.statement.bodyAsText
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

fun Application.configureAuth(httpClient: HttpClient) {

    install(Sessions) {
        cookie<UserSession>("user_session") {
            cookie.httpOnly = true
            // cookie.secure = true  // Включить в проде (HTTPS)
            cookie.path = "/"
        }
    }

    val redirects = ConcurrentHashMap<String, String>()
    install(Authentication) {
        oauth("oauth-google") {
            // Configure oauth authentication
            urlProvider = { "http://localhost:8080/callback" }
            providerLookup = {
                OAuthServerSettings.OAuth2ServerSettings(
                    name = "google",
                    authorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth",
                    accessTokenUrl = "https://oauth2.googleapis.com/token",
                    requestMethod = HttpMethod.Post,
                    clientId = System.getenv("GOOGLE_CLIENT_ID"),
                    clientSecret = System.getenv("GOOGLE_CLIENT_SECRET"),
                    defaultScopes = listOf("openid", "email", "profile"),
                    extraAuthParameters = listOf("access_type" to "offline"),
                    onStateCreated = { call, state ->
                        call.request.queryParameters["redirectUrl"]?.let {
                            redirects[state] = it
                        }
                    }
                )
            }
            client = httpClient
        }

        session<UserSession>("session-auth") {
            validate { session ->
                val now = Instant.now().epochSecond

                if (session.expiresAt > now + 30) {
                    return@validate UserIdPrincipal(session.state)
                }

                if (session.refreshToken != null) {
                    val refreshed = tryRefreshToken(httpClient, session)
                    if (refreshed != null) {
                        // Обновляем cookie
                        sessions.set(refreshed)
                        return@validate UserIdPrincipal(refreshed.state)
                    }
                }
                null
            }

            challenge {
                val original = call.request.uri
                val redirectUrl = "/login?redirectUrl=" + URLEncoder.encode(original, StandardCharsets.UTF_8)
                call.respondRedirect(redirectUrl)
            }
        }

    }


    routing {
        authenticate("oauth-google") {
            get("/login") {
                // Redirects to 'authorizeUrl' automatically
            }

            get("/callback") {
                val currentPrincipal: OAuthAccessTokenResponse.OAuth2? = call.principal()
                currentPrincipal?.let { principal ->
                    principal.state?.let { state ->
                        val now = Instant.now().epochSecond
                        val expiresAt = principal.expiresIn + now
                        val accessToken = principal.accessToken
                        val refreshToken = principal.refreshToken

                        val userSession = UserSession(
                            state = state,
                            accessToken = accessToken,
                            expiresAt = expiresAt,
                            refreshToken = refreshToken,
                        )
                        call.sessions.set(userSession)
                        redirects[state]?.let { redirect ->
                            call.respondRedirect(redirect)
                            return@get
                        }
                    }
                }
                call.respondRedirect("/home")
            }

        }

        authenticate("session-auth") {
            get("/home") {
                val userSession: UserSession? = getSession(call)
                if (userSession != null) {
                    val userInfo: UserInfo = fetchUserInfo(httpClient, userSession.accessToken)
                    call.respondText("Hello, ${userInfo.name}! $userInfo")
                }
            }
        }
    }
}


private suspend fun fetchUserInfo(httpClient: HttpClient, accessToken: String): UserInfo {
    val res = httpClient.get("https://openidconnect.googleapis.com/v1/userinfo") {
        header(HttpHeaders.Authorization, "Bearer $accessToken")
    }
    return res.body()
}


private suspend fun getSession(
    call: ApplicationCall
): UserSession? {
    val userSession: UserSession? = call.sessions.get()
    //if there is no session, redirect to login
    if (userSession == null) {
        val redirectUrl = URLBuilder("http://localhost:8080/login").run {
            parameters.append("redirectUrl", call.request.uri)
            build()
        }
        call.respondRedirect(redirectUrl)
        return null
    }
    return userSession
}

private suspend fun tryRefreshToken(
    httpClient: HttpClient,
    old: UserSession
): UserSession? {
    val refresh = old.refreshToken ?: return null
    return try {
        val response = httpClient.post("https://oauth2.googleapis.com/token") {
            contentType(ContentType.Application.FormUrlEncoded)
            setBody(
                Parameters.build {
                    append("client_id", System.getenv("GOOGLE_CLIENT_ID"))
                    append("client_secret", System.getenv("GOOGLE_CLIENT_SECRET"))
                    append("grant_type", "refresh_token")
                    append("refresh_token", refresh)
                }.formUrlEncode()
            )
        }

        if (!response.status.isSuccess()) return null

        val bodyText = response.bodyAsText()
        val jsonEl = Json.parseToJsonElement(bodyText)
        val obj = jsonEl.jsonObject

        val newAccess = obj["access_token"]?.let { Json.decodeFromJsonElement<String>(it) } ?: return null
        val expiresIn = obj["expires_in"]?.let { Json.decodeFromJsonElement<Long>(it) } ?: 3600L
        val now = Instant.now().epochSecond
        val newExpiresAt = now + expiresIn

        old.copy(
            accessToken = newAccess,
            expiresAt = newExpiresAt,
        )
    } catch (_: Exception) {
        null
    }
}

@Serializable
data class UserSession(
    val state: String,
    val accessToken: String,
    val expiresAt: Long,
    val refreshToken: String? = null,
)


@Serializable
data class UserInfo(
    val sub: String? = null,
    val name: String,
    @SerialName("given_name") val givenName: String,
    @SerialName("family_name") val familyName: String,
    val hd: String? = null,
    val picture: String? = null,
    val email: String,
    @SerialName("email_verified") val emailVerified: Boolean,
)