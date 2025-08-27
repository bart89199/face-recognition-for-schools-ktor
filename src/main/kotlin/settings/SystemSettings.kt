package com.batr.settings

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.receiveOrRespond
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.File
import java.util.Locale
import java.util.Locale.getDefault
import kotlin.properties.Delegates

@Serializable
data class SystemSettings(
    @SerialName("close_delay_ms") val closeDelayMs: Int,
    @SerialName("save_detection") val saveDetection: Boolean,
    @SerialName("use_arduino") val useArduino: Boolean,
)


private val defaultSettings = SystemSettings(
    closeDelayMs = 1000,
    saveDetection = false,
    useArduino = false,
)

@Serializable
data class SettingModel(
    val name: String,
    val value: String,
    val comment: String,
)

@Serializable
data class SettingUpdate(
    val name: String,
    val value: String,
)

fun SystemSettings.toModel(): List<SettingModel> {
    val list = ArrayList<SettingModel>()
    list.add(
        SettingModel(
            "close_delay_ms",
            closeDelayMs.toString(),
            "Время, через которое закроется дверь после открытия"
        )
    )
    list.add(
        SettingModel(
            "save_detection",
            saveDetection.toString(),
            "Сохранять ли изображение в базу при распознавании"
        )
    )
    list.add(SettingModel("use_arduino", useArduino.toString(), "Использовать ли arduino для управления дверью"))
    return list
}

private val invalidValueException = IllegalArgumentException("Invalid value")
private val invalidNameException = IllegalArgumentException("Invalid setting name")

private fun parseInt(value: String) = try {
    value.toInt()
} catch (_: NumberFormatException) {
    throw invalidValueException
}

private fun parseBoolean(value: String) = when (value.lowercase()) {
    "true" -> true
    "false" -> false
    else -> throw invalidValueException
}

enum class UpdateSettingStatus(val statusCode: HttpStatusCode, val message: String) {
    OK(HttpStatusCode.OK, ""),
    INVALID_NAME(HttpStatusCode.BadRequest, "invalid name"),
    INVALID_VALUE(HttpStatusCode.BadRequest, "invalid value"),
}

fun SystemSettings.update(name: String, value: String): SystemSettings = when (name) {
    "close_delay_ms" -> copy(closeDelayMs = parseInt(value))
    "save_detection" -> copy(saveDetection = parseBoolean(value))
    "use_arduino" -> copy(useArduino = parseBoolean(value))

    else -> throw invalidNameException
}

object SystemSettingsService {
    private val json = Json { prettyPrint = true }
    private var file by Delegates.notNull<File>()
    var systemSettings by Delegates.notNull<SystemSettings>()
        private set

    fun load(app: Application) {
        file = File(app.environment.config.property("settings.path").getString())
        if (file.exists()) {
            systemSettings = try {
                json.decodeFromString<SystemSettings>(file.readText())
            } catch (e: IllegalArgumentException) {
                e.printStackTrace()
                defaultSettings
            } catch (e: SerializationException) {
                e.printStackTrace()
                defaultSettings
            }
        } else {
            file.createNewFile()
            systemSettings = defaultSettings
        }
    }

    fun save() {
        file.writeText(json.encodeToString(systemSettings))
    }

    fun update(name: String, value: String): UpdateSettingStatus {
        try {
            systemSettings = systemSettings.update(name, value)
        } catch (e: IllegalArgumentException) {
            if (e == invalidValueException) {
                return UpdateSettingStatus.INVALID_VALUE
            }
            if (e == invalidNameException) {
                return UpdateSettingStatus.INVALID_NAME
            }
            throw e
        }
        save()
        return UpdateSettingStatus.OK
    }

    fun configureRouting(app: Application) {
        app.routing {
            authenticate("session-auth") {
                setPermissions(UserPermissions(settings = true)) {
                    route("/api/settings") {
                        get {
                            call.respond(systemSettings.toModel())
                        }
                        put {
                            val upd = call.receiveOrRespond<SettingUpdate>() ?: return@put
                            val res = update(upd.name, upd.value)
                            call.respond(res.statusCode, res.message)
                        }
                    }
                }
            }
        }
    }
}
