package com.batr

import com.batr.auth.configureAuth
import com.batr.database.Database.configureDatabase
import com.batr.log.AdminLogService
import com.batr.log.SystemLogService
import com.batr.log.SystemLogType
import com.batr.log.loadLogConsts
import com.batr.settings.SystemSettingsService
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

    monitor.subscribe(ApplicationStarted) {
//        SystemLogService.logB(SystemLogType.SYSTEM_START, "System started")
        try {
            SystemSettingsService.load(this)
        }catch (e: Throwable) {
            e.printStackTrace()
        }
    }

    monitor.subscribe(ApplicationStopped) {
//        SystemLogService.logB(SystemLogType.SYSTEM_STOP, "System stoped")
        try {
            SystemSettingsService.save()
        } catch (e: Throwable) {
            e.printStackTrace()
        }
    }

    SystemSettingsService.configureRouting(this)
    
    // Enable for testing only - comment out when authentication is fully configured
    configureSerialization()
    configureRouting()


//    loadLogConsts()

//    configureDatabase()
//    configureAuth()
//    SystemLogService.load()
//    AdminLogService.load()

//    configureSerialization()
//    configureSockets()
//    configureRouting()
//    configureAccess()

//    SystemLogService.configureRouting(this)
//    AdminLogService.configureRouting(this)

//    configureStreaming()
//    configureDoor()
//    configureInfo()
//    configureTest()
}
