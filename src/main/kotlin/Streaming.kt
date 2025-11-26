package com.batr

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.partialcontent.PartialContent
import io.ktor.server.response.respondFile
import io.ktor.server.routing.*
import java.io.File

fun Application.configureStreaming() {
    routing {
        authenticate("session-auth") {
            setPermissions(UserPermissions(stream = true)) {
                staticFiles("stream", File(environment.config.property("stream.path").getString()))
            }
        }
    }
}