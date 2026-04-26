package com.batr.auth

import com.batr.getEnvOrEnvFile
import io.ktor.server.application.Application
import io.ktor.server.auth.AuthenticationConfig
import io.ktor.server.auth.bearer
import java.nio.file.attribute.UserPrincipal

fun AuthenticationConfig.configureBeaterAuthPlugin(app: Application) {
    bearer("bearer-auth") {
        authenticate { token ->
            if (token.token == getEnvOrEnvFile("PY_TOKEN")) {
                UserPrincipal { "Python" }
            } else {
                null
            }
        }
    }
}