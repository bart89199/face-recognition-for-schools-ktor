package com.batr

import com.batr.auth.configureAuth
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

val applicationHttpClient = HttpClient(CIO) {
    install(io.ktor.client.plugins.contentnegotiation.ContentNegotiation) {
        json()
    }
}

fun Application.module(httpClient: HttpClient = applicationHttpClient) {
    configureAuth(httpClient)
    configureStreaming()
    configureSerialization()
    configureSockets()
    configureRouting()
    configureDoor()
    configureInfo()
    configureSettings()
    configureAccess()
}
