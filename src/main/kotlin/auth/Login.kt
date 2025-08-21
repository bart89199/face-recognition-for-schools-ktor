package com.batr.auth

import com.batr.HOME_PATH
import com.batr.auth.session.CookieUserSession
import com.batr.auth.session.check
import com.batr.auth.session.delete
import com.batr.auth.user.UserService
import com.batr.auth.user.newSession
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*

fun Application.configureLoginRouting() {
    routing {
        alreadyLogin {
            staticResources("/login", "login")
        }
        get("/logout") {
            val session = call.getSession(false) ?: return@get
            session.delete()
            call.sessions.clear<CookieUserSession>()
            call.respondRedirect(HOME_PATH)
        }
        post("/api/login/local") {
            val input = call.receive<Map<String, String>>()
            val email = input["email"]
            val password = input["password"]
            if (email == null || password == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@post
            }
            val user = UserService.login(email, password)
            if (user == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@post
            }
            val session = user.newSession(call)
            call.sessions.set(CookieUserSession(session.token))
            call.respond(HttpStatusCode.OK)
        }
    }
}

private val AlreadyLoginPlugin = createRouteScopedPlugin("AlreadyLoginPlugin") {
    onCall { call ->
        val session = call.getSession(false)
        if (session.check()) {
            call.respondRedirect(call.request.queryParameters["redirectUrl"] ?: HOME_PATH)
        }
    }
}

private fun Route.alreadyLogin(build: Route.() -> Unit) {
    val route = createChild(BlankRouteSelector())
    route.install(AlreadyLoginPlugin)
    route.build()
}