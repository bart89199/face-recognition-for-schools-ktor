package com.batr.auth

import com.batr.LOGIN_PATH
import com.batr.auth.session.CookieUserSession
import com.batr.auth.session.UserSession
import com.batr.auth.session.check
import com.batr.auth.session.getSession
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.sessions.*
import io.ktor.server.util.*
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

fun AuthenticationConfig.configureSessionAuthPlugin() {
    session<CookieUserSession>("session-auth") {
        validate { token ->
            val session = token.getSession()
            if (!session.check()) {
                return@validate null
            }
            return@validate UserIdPrincipal(session!!.userId.toString())

        }

        challenge {
            val redirectUrl = call.url {
                path(LOGIN_PATH)
                parameters.append("redirectUrl", call.request.uri)
                build()
            }
            call.respondRedirect(redirectUrl)
        }
    }
}

fun SessionsConfig.configureSessionsPlugin() {
    cookie<CookieUserSession>("user_session") {
        cookie.httpOnly = true
        // cookie.secure = true  // Включить в проде (HTTPS)
        cookie.path = "/"
    }
}

suspend fun ApplicationCall.getSession(autoRedirect: Boolean = true): UserSession? {
    val token: CookieUserSession? = sessions.get()
    val session = token?.getSession()
    if (session == null) {
        val redirectUrl = url {
            path(LOGIN_PATH)
            parameters.append("redirectUrl", request.uri)
            build()
        }
        respondRedirect(redirectUrl)
        return null
    }
    return session
}


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
