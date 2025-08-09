package com.batr

import io.ktor.server.application.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    configureStreaming()
    configureSerialization()
    configureDatabases()
    configureSockets()
    configureRouting()
}
