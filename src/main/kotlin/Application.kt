package com.batr

import com.batr.pythonConnection.PythonConnection
import io.ktor.server.application.*
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.netty.EngineMain.createServer
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

fun main(args: Array<String>) = runBlocking<Unit> {


    val server = createServer(args)


//    server.monitor.subscribe(ApplicationStarted) {
//        println("server started")
//        PythonConnection.connect()
//
//    }


    server.start(true)


}

fun Application.module() {
    configureSerialization()
//    configureDatabases()
    configureSockets()
    configureRouting()

    configureStreaming()
}
