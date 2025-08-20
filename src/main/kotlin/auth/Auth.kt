package com.batr.auth

import com.batr.auth.session.SessionService
import com.batr.auth.user.UserService
import com.batr.auth.user.configureUserManagement
import io.ktor.server.application.*
import io.ktor.server.auth.*
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

}
