package com.batr

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.CacheControl
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.partialcontent.PartialContent
import io.ktor.server.request.contentType
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.response.respondFile
import io.ktor.server.response.respondText
import io.ktor.server.routing.*
import java.io.File

fun Application.configureStreaming() {
    routing {
        authenticate("session-auth") {
            setPermissions(UserPermissions(stream = true)) {
                post("/api/stream/offer") {
                    // 1. Получаем SDP Offer от браузера
                    val offerBody = call.receiveText()
                    val offerContentType = call.request.contentType()

                    try {
                        // 2. Проксируем запрос в Python (WebRTC Server)
                        // Предполагаем, что Python запущен на том же хосте, порт 8080
                        val response = applicationHttpClient.post("http://0.0.0.0:5050/offer") {
                            this.setBody(offerBody)
                            this.contentType(offerContentType)
                        }

                        // 3. Возвращаем SDP Answer браузеру
                        call.respondText(
                            text = response.bodyAsText(),
                            status = response.status,
                            contentType = response.contentType() ?: ContentType.Application.Json
                        )
                    } catch (e: Exception) {
//                        e.printStackTrace()
                        call.respond(HttpStatusCode.BadGateway, "Failed to connect to Python WebRTC server")
                    }
                }
                // Configure staticFiles with cache control
//                staticFiles("stream", File(environment.config.property("stream.path").getString())) {
//                    cacheControl { file ->
//                        if (file.name.endsWith(".m3u8")) {
//                            // Disable cache for playlist to ensure live updates
//                            listOf(CacheControl.NoCache(visibility = CacheControl.Visibility.Public))
//                        } else {
//                            emptyList()
//                        }
//                    }
//                }
            }
        }
    }
}