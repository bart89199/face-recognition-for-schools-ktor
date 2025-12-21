package com.batr

import com.batr.auth.configureAuth
import com.batr.database.Database.configureDatabase
import com.batr.log.AdminLogService
import com.batr.log.SystemLogService
import com.batr.log.SystemLogType
import com.batr.log.loadLogConst
import com.batr.pythonConnection.PythonConnection
import com.batr.settings.SystemSettingsService
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*

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
    try {
        monitor.subscribe(ApplicationStarted) {
            SystemLogService.logB(SystemLogType.SYSTEM_START, "System started")
            try {
                SystemSettingsService.load(this)
            } catch (e: Throwable) {
                e.printStackTrace()
            }
        }

        monitor.subscribe(ApplicationStopped) {
            SystemLogService.logB(SystemLogType.SYSTEM_STOP, "System stoped")
            try {
                SystemSettingsService.save()
            } catch (e: Throwable) {
                e.printStackTrace()
            }
        }

        install(CORS) {
            allowMethod(HttpMethod.Options)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Delete)
            allowMethod(HttpMethod.Patch)
            allowHeader(HttpHeaders.Authorization)
            allowHeader("MyCustomHeader")
            anyHost() // @TODO: Don't do this in production if possible. Try to limit it.
        }



        loadLogConst()
        Records.load(this)

        configureDatabase()
        configureAuth()
        SystemLogService.load()
        AdminLogService.load()

        configureSerialization()

        SystemSettingsService.configureRouting(this)
        configureSockets()
        configureRouting()
        configureAccess()

        SystemLogService.configureRouting(this)
        AdminLogService.configureRouting(this)
        Records.configureRouting(this)

        configureStreaming()
        configureInfo()
        configureTest()

        PythonConnection.configureRouting(this)

    } catch (e: Throwable) {
        e.printStackTrace()
    }

}
