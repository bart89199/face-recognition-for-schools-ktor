package com.batr

import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.http.content.*
import io.ktor.server.routing.*
import java.io.File

fun Application.configureStreaming() {
//    install(CORS) {
//        anyHost() // в dev можно так, в проде лучше явно указывать домены
//        allowCredentials = true
//        allowNonSimpleContentTypes = true
//        allowHeader(HttpHeaders.ContentType)
//        allowMethod(HttpMethod.Get)
//        allowMethod(HttpMethod.Post)
//        allowMethod(HttpMethod.Options)
//
////        allowHeader("cart_session")
////        exposeHeader("cart_session")
//    }
    routing {
        authenticate("session-auth") {
            staticFiles("stream", File("C:/Users/suslo/testweb/hsl")) {}
        }
    }
}