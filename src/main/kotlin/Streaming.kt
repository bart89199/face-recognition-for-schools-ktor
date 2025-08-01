package com.batr

import com.batr.pythonConnection.PythonConnection
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.http.content.files
import io.ktor.server.http.content.static
import io.ktor.server.http.content.staticFiles
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import java.io.File

fun Application.configureStreaming() {
    install(ContentNegotiation) {
        json()
    }
    routing {
        get("/test") {
            try {
                PythonConnection.sendString("test message")
                val msg = PythonConnection.receiveString()
                call.respondText("Received: $msg")
            } catch (ex: IllegalStateException) {
                call.respond(HttpStatusCode.NoContent)
            }
        }

        route("/hls") {
            staticFiles("stream.m3u8", File("C:\\Users\\suslo\\testweb\\hlss\\stream.m3u8")) {

            }  // Папка с stream.m3u8 и .ts сегментами
        }

    }


}