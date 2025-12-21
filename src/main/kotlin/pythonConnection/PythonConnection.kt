package com.batr.pythonConnection

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.log.AdminLogType
import com.batr.log.SystemLogType
import com.batr.log.log
import com.batr.log.sysLog
import com.batr.receiveOrRespond
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

object PythonConnection {
    var systemStatus: SystemStatus? = null
        private set
    var forceDoor: Boolean? = null
        private set

    private suspend fun updateStatus(newStatus0: SystemStatus) {
        var newStatus = newStatus0
        forceDoor?.let {
            newStatus = newStatus.copy(door = it)
        }

        if (systemStatus?.door == false && newStatus.door) {
            sysLog(SystemLogType.DOOR, "Door opened")
        }
        if (systemStatus?.door == true && !newStatus.door) {
            sysLog(SystemLogType.DOOR, "Door closed")
        }

        for (name in newStatus.recognitions) {
            if (systemStatus?.recognitions?.contains(name) == false) {
                sysLog(SystemLogType.RECOGNIZE, "$name was recognized")
            }
        }

        systemStatus = newStatus

    }

    fun configureRouting(app: Application) {
        app.routing {
            authenticate("bearer-auth") {
                route("api/py") {
                    post("/status") {
                        val newStatus = call.receive<RawSystemStatus>()
                        updateStatus(SystemStatus(newStatus.status, System.currentTimeMillis(), newStatus.door, newStatus.recognitions))
                        call.respond(HttpStatusCode.OK)
                    }
                }
            }
            authenticate("session-auth") {
                setPermissions(UserPermissions(doorControl = true)) {
                    route("/api/door/force") {
                        get {
                            call.respond(forceDoor.toString())
                        }
                        post {
                            val newStatus = call.receiveOrRespond<DoorForceStatus>() ?: return@post
                            val session = call.getSession() ?: return@post
                            session.log(AdminLogType.FORCE_DOOR, "changed ${forceDoor.toDoorStatus()} to ${newStatus.status.toDoorStatus()}")
                            sysLog(SystemLogType.DOOR, "door force changed  ${forceDoor.toDoorStatus()} to ${newStatus.status.toDoorStatus()}")
                            forceDoor = newStatus.status
                            call.respond(HttpStatusCode.OK)
                        }
                    }
                }
            }
        }
    }
}

@Serializable
data class DoorForceStatus(
    val status: Boolean?
)

fun Boolean?.toDoorStatus() = when(this) {
    true -> "open"
    false -> "closed"
    null -> "auto"
}

@Serializable
data class RawSystemStatus(
    @SerialName("system_status") val status: String,
    val door: Boolean,
    val recognitions: List<String>
)

@Serializable
data class SystemStatus(
    val status: String,
    val time: Long,
    val door: Boolean,
    val recognitions: List<String>
)

@Serializable
data class ExSystemStatus(
    val status: String,
    val time: Long,
    val door: Boolean,
    val forceDoor: Boolean?,
    val recognitions: List<String>
)