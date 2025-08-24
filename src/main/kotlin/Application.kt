package com.batr

import com.batr.auth.configureAuth
import com.batr.database.Database.configureDatabase
import com.batr.log.LogService
import com.batr.log.LogService.configureLogManagers
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*

const val HOME_PATH = "/"
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
    LogService.load()

    configureSerialization()
    configureSockets()
    configureRouting()
    configureAccess()

    configureLogManagers()

//    UserService.getAll().forEach { user ->
//        val permissions = user.permissions
//        if (permissions.manageUsers != null) {
//            val newPermissions = permissions.copy(admin = permissions.manageUsers, manageUsers = null)
//            UserService.update(user.id, newPermissions = newPermissions)
//        }
//    }

    configureStreaming()
    configureDoor()
    configureInfo()
    configureSettings()
    configureTest()
}
