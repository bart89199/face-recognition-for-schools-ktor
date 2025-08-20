package com.batr.auth

import com.batr.HOME_PATH
import com.batr.auth.session.CookieUserSession
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
        staticResources("/login", "login") {

//            get {
//                if (call.getSession() != null) {
//                    call.respondRedirect(HOME_PATH)
//                    return@get
//                }
//            }
        }

        get("/logout") {
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
            val session = user.newSession()
            call.sessions.set(CookieUserSession(session.token))
            call.respond(HttpStatusCode.OK)
        }
    }
}