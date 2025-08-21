package com.batr.auth

import com.batr.HOME_PATH
import com.batr.applicationHttpClient
import com.batr.auth.session.CookieUserSession
import com.batr.auth.session.GoogleAccess
import com.batr.auth.session.SessionService
import com.batr.auth.session.delete
import com.batr.auth.session.getRequestData
import com.batr.auth.user.UserService
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import java.util.concurrent.ConcurrentHashMap

private val redirects = ConcurrentHashMap<String, String>()

fun AuthenticationConfig.configureGoogleOauthPlugin(application: Application) {

    oauth("oauth-google") {
        urlProvider = { "http://localhost:8080/callback" }
        providerLookup = {
            OAuthServerSettings.OAuth2ServerSettings(
                name = "google",
                authorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth",
                accessTokenUrl = "https://oauth2.googleapis.com/token",
                requestMethod = HttpMethod.Post,
                clientId = application.environment.config.property("googleapi.auth.google-client-id")
                    .getString(),
                clientSecret = application.environment.config.property("googleapi.auth.google-client-secret")
                    .getString(),
                defaultScopes = listOf("openid", "email", "profile"),
                extraAuthParameters = listOf("access_type" to "offline"),
                onStateCreated = { call, state ->
                    call.request.queryParameters["redirectUrl"]?.let {
                        redirects[state] = it
                    }
                }
            )
        }
        client = applicationHttpClient
    }
}

fun Application.configureGoogleOauthRooting() {
    routing {
        authenticate("oauth-google") {
            get("login/google") {
                // Redirects to 'authorizeUrl' automatically
            }
            get("callback") {
                val currentPrincipal: OAuthAccessTokenResponse.OAuth2? = call.principal()
                currentPrincipal?.let { principal ->
                    principal.state?.let { state ->
                        call.sessions.get<CookieUserSession>()?.delete()

                        val userInfo = fetchUserInfo(principal.accessToken)
                        val user = UserService.getByEmail(userInfo.email)
                        if (user == null) {
                            call.response.status(HttpStatusCode.Forbidden)
                            return@get
                        }

                        val googleAccess = GoogleAccess(
                            principal.accessToken,
                            principal.expiresIn + System.currentTimeMillis(),
                            principal.refreshToken
                        )
                        val newSession = SessionService.create(user.id, requestData = call.getRequestData(), googleAccess = googleAccess)
                        call.sessions.set(CookieUserSession(newSession.token))

                        redirects[state]?.let { redirect ->
                            call.respondRedirect(redirect)
                            return@get
                        }
                    }
                }
                call.respondRedirect(HOME_PATH)
            }

        }
    }
}

private suspend fun fetchUserInfo(accessToken: String, httpClient: HttpClient = applicationHttpClient): UserInfo =
    httpClient.get("https://openidconnect.googleapis.com/v1/userinfo") {
        header(HttpHeaders.Authorization, "Bearer $accessToken")
    }.body()
