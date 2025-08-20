package com.batr.auth

import com.batr.auth.session.SessionService
import com.batr.auth.session.getUser
import com.batr.auth.user.UserService
import com.batr.auth.user.configureUserManagement
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*

fun Application.configureAuth() {

    UserService.load()
    SessionService.load(this)

    configureLoginRouting()

    install(Sessions) {
        configureSessionsPlugin()
    }
    install(Authentication) {
        configureGoogleOauthPlugin(this@configureAuth)
        configureSessionAuthPlugin()
    }
    configureGoogleOauthRooting()

    configureUserManagement()

    routing {
        authenticate("session-auth", optional = false) {
            get("/home") {
                val session = call.getSessionOrRedirect()
                if (session != null) {
                    val user = session.getUser()
                    call.respondText("Hello, ${user.name}! $")
                }
            }
        }

    }

}

