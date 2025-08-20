package com.batr

import com.batr.auth.configureAuth
import com.batr.database.Database.configureDatabase
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.*

const val HOME_PATH = "/home"
const val LOGIN_PATH = "/login"
fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

val applicationHttpClient = HttpClient(CIO) {
    install(io.ktor.client.plugins.contentnegotiation.ContentNegotiation) {
        json()
    }
}

fun Application.module() {
    configureDatabase()
    configureAuth()

    configureSerialization()
    configureSockets()
    configureRouting()
    configureAccess()

    configureStreaming()
    configureDoor()
    configureInfo()
    configureSettings()
    configureTest()
}
