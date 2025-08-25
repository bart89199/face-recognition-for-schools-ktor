package com.batr.auth

import com.batr.HOME_PATH
import com.batr.auth.session.CookieUserSession
import com.batr.auth.session.SessionService.logout
import com.batr.auth.session.check
import com.batr.auth.session.delete
import com.batr.auth.user.UserService
import com.batr.auth.user.newSession
import com.batr.log.AdminLogType
import com.batr.log.log
import com.batr.receiveOrRespond
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

fun Application.configureLoginRouting() {
    routing {
        alreadyLogin {
            staticResources("/login", "login")
        }
        get("/logout") {
            val session = call.getSession(false) ?: return@get
            session.logout(call)
            call.respondRedirect(HOME_PATH)
        }
        post("/api/login/local") {
            val input = call.receiveOrRespond<LoginData>() ?: return@post
            val email = input.email
            val password = input.password
            val longLogin = input.longLogin

            val oldSession = call.getSession(false)
            oldSession?.logout(call)

            val user = UserService.login(email, password)
            if (user == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@post
            }
            val session = user.newSession(call, longLogin)
            session.log(AdminLogType.USER_LOGIN, "user login")
            call.sessions.set(CookieUserSession(session.token))
            call.respond(HttpStatusCode.OK)
        }
    }
}

private val AlreadyLoginPlugin = createRouteScopedPlugin("AlreadyLoginPlugin") {
    onCall { call ->
        val session = call.getSession(false)
        if (session?.check() == true) {
            call.respondRedirect(call.request.queryParameters["redirectUrl"] ?: HOME_PATH)
        }
    }
}

private fun Route.alreadyLogin(build: Route.() -> Unit) {
    val route = createChild(BlankRouteSelector())
    route.install(AlreadyLoginPlugin)
    route.build()
}

@Serializable
private data class LoginData(
    val email: String,
    val password: String,
    @SerialName("long_login") val longLogin: Boolean = false
)