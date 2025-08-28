package com.batr.auth

import io.ktor.server.application.Application
import io.ktor.server.auth.AuthenticationConfig
import io.ktor.server.auth.bearer
import java.nio.file.attribute.UserPrincipal

fun AuthenticationConfig.configureBeaterAuthPlugin(app: Application) {
    bearer("bearer-auth") {
        authenticate { token ->
            if (token.token == app.environment.config.property("python.bearer-token").getString()) {
                UserPrincipal { "Python" }
            } else {
                null
            }
        }
    }
}