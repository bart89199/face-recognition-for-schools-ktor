package com.batr

import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.http.content.staticFiles
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import java.io.File

fun Application.configureStreaming() {
    install(CORS) {
        anyHost() // в dev можно так, в проде лучше явно указывать домены
        allowCredentials = true
        allowNonSimpleContentTypes = true
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Options)
    }
    routing {
//        route ("/hsl") {
        staticFiles("stream", File("C:/Users/suslo/testweb/hsl")) {
            default("stream.m3u8")
        }
//        }
    }
}