package com.batr.settings

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.log.AdminLogService
import com.batr.log.AdminLogType
import com.batr.log.SystemLogType
import com.batr.log.log
import com.batr.log.sysLog
import com.batr.receiveOrRespond
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.auth.authenticate
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
import kotlin.math.max
import kotlin.properties.Delegates

@Serializable
data class SystemSettings(
    @SerialName("close_delay_ms") val closeDelayMs: Int,
    @SerialName("save_detection") val saveDetection: Boolean,
    @SerialName("use_arduino") val useArduino: Boolean,
    @SerialName("forms_autoload") val formsAutoload: Boolean,
    @SerialName("forms_check_interval_ms") val formsCheckIntervalMs: Int,

    @SerialName("last_frames_amount") val lastFramesAmount: Int,
    @SerialName("min_frames_for_detection") val minFramesForDetection: Int,
    @SerialName("need_blinks") val needBlinks: Int,
    @SerialName("frames_for_eyes_check") val framesForEyesCheck: Int,
    @SerialName("wait_frames_for_detection") val waitFramesForDetection: Int,
    @SerialName("cam_port") val camPort: String,
    @SerialName("arduino_port") val arduinoPort: String,
    @SerialName("max_faces") val maxFaces: Int,
    @SerialName("face_detection_mode") val faceDetectionMode: Int,
    @SerialName("max_avg_distance") val maxAvgDistance: Double,
    @SerialName("max_percent_distance") val maxPercentDistance: Double,
    @SerialName("min_match_for_person") val minMatchForPerson: Double,
    @SerialName("save_delay_ms") val saveDelayMs: Int,
    @SerialName("min_eyes_difference") val minEyesDifference: Double,
    @SerialName("min_dif_for_blink") val minDifForBlink: Double,
    @SerialName("blinked_eyes_open") val blinkedEyesOpen: Boolean,
    @SerialName("close_eyes_threshold") val closeEyesThreshold: Double,
)

fun SystemSettings.update(name: String, value: String): SystemSettings = when (name) {
    "close_delay_ms" -> copy(closeDelayMs = parseInt(value, 100, 1e9.toInt()))
    "save_detection" -> copy(saveDetection = parseBoolean(value))
    "use_arduino" -> copy(useArduino = parseBoolean(value))
    "forms_autoload" -> copy(formsAutoload = parseBoolean(value))
    "forms_check_interval_ms" -> copy(formsCheckIntervalMs = parseInt(value, 100, 1e9.toInt()))

    "last_frames_amount" -> copy(lastFramesAmount = parseInt(value, 0, 1000))
    "min_frames_for_detection" -> copy(minFramesForDetection = parseInt(value, 0, 1000))
    "need_blinks" -> copy(needBlinks = parseInt(value, 0, 1000))
    "frames_for_eyes_check" -> copy(framesForEyesCheck = parseInt(value, 0, 1000))
    "wait_frames_for_detection" -> copy(waitFramesForDetection = parseInt(value, 0, 1000))
    "cam_port" -> copy(camPort = value)
    "arduino_port" -> copy(arduinoPort = value)
    "max_faces" -> copy(maxFaces = parseInt(value, 0, 1000))
    "face_detection_mode" -> copy(faceDetectionMode = parseInt(value, 1, 2))
    "max_avg_distance" -> copy(maxAvgDistance = parseDouble(value, 0.0, 1.0))
    "max_percent_distance" -> copy(maxPercentDistance = parseDouble(value, 0.0, 1.0))
    "min_match_for_person" -> copy(minMatchForPerson = parseDouble(value, 0.0, 1.0))
    "save_delay_ms" -> copy(saveDelayMs = parseInt(value, 0, 1e9.toInt()))
    "min_eyes_difference" -> copy(minEyesDifference = parseDouble(value, 0.0, 10.0))
    "min_dif_for_blink" -> copy(minDifForBlink = parseDouble(value, 0.0, 10.0))
    "blinked_eyes_open" -> copy(blinkedEyesOpen = parseBoolean(value))
    "close_eyes_threshold" -> copy(closeEyesThreshold = parseDouble(value, 0.0, 10.0))

    else -> throw invalidNameException
}

fun SystemSettings.toModel(): List<SettingModel> {
    val list = ArrayList<SettingModel>()
    list.add(SettingModel("close_delay_ms", closeDelayMs.toString(), "Время, через которое закроется дверь после открытия"))
    list.add(SettingModel("save_detection", saveDetection.toString(), "Сохранять ли изображение в базу при распознавании"))
    list.add(SettingModel("use_arduino", useArduino.toString(), "Использовать ли arduino для управления дверью"))
    list.add(SettingModel("forms_autoload", formsAutoload.toString(), "Авто подгружать ответы с гугл форм"))
    list.add(SettingModel("forms_check_interval_ms", formsCheckIntervalMs.toString(), "Период проверки гугл форм"))
    list.add(SettingModel("last_frames_amount", lastFramesAmount.toString(), "Сколько предыдущих кадров храниться"))
    list.add(SettingModel("min_frames_for_detection", minFramesForDetection.toString(), "Необходимое количество распознанных фреймов для подтверждения распознавания"))
    list.add(SettingModel("need_blinks", needBlinks.toString(), "Необходимое количество морганий для распознавания"))
    list.add(SettingModel("frames_for_eyes_check", framesForEyesCheck.toString(), "Количество фреймов на проверку морганий"))
    list.add(SettingModel("wait_frames_for_detection", waitFramesForDetection.toString(), "Через сколько фреймов будет подтверждено распознавание"))
    list.add(SettingModel("cam_port", camPort, "Протокол подключения камеры"))
    list.add(SettingModel("arduino_port", arduinoPort, "Протокол подключения ардуино"))
    list.add(SettingModel("max_faces", maxFaces.toString(), "Максимально количество захваченных лиц на кадре"))
    list.add(SettingModel("face_detection_mode", faceDetectionMode.toString(), "1 - проверяет среднюю разницу лиц(по всем сохранённым), 2 - проверяет процент распознанных сохранённых кадров"))
    list.add(SettingModel("max_avg_distance", maxAvgDistance.toString(), "Максимальная разница лиц для распознавания кадра"))
    list.add(SettingModel("max_percent_distance", maxPercentDistance.toString(), "Максимальная разница лиц для распознавания по средней разнице"))
    list.add(SettingModel("min_match_for_person", minMatchForPerson.toString(), "Минимальный процент для распознавания для распознавания по проценту распознанных сохранённых кадров"))
    list.add(SettingModel("save_delay_ms", saveDelayMs.toString(), "Задержка сохранения кадра(для сохранения при распознавании)"))
    list.add(SettingModel("min_eyes_difference", minEyesDifference.toString(), "Минимальная разница значений глаз для детекта пре моргания"))
    list.add(SettingModel("min_dif_for_blink", minDifForBlink.toString(), "Минимальная часть фреймов с детектом преморгания для распознавания моргания"))
    list.add(SettingModel("blinked_eyes_open", blinkedEyesOpen.toString(), "Открывать ли дверь человеку с закрытыми глазами"))
    list.add(SettingModel("close_eyes_threshold", closeEyesThreshold.toString(), "Порог закрытого глаза(среднее значение глаза <= прог)"))
    return list
}

private val defaultSettings =
    SystemSettings(
        closeDelayMs = 1000,
        saveDetection = false,
        useArduino = false,
        formsAutoload = true,
        formsCheckIntervalMs = 10_000,
        lastFramesAmount = 25,
        minFramesForDetection = 15,
        needBlinks = 1,
        framesForEyesCheck = 9,
        waitFramesForDetection = 5,
        camPort = "/dev/video0",
        arduinoPort = "/dev/ttyUSB0",
        maxFaces = 12,
        faceDetectionMode = 2,
        maxAvgDistance = 0.54,
        maxPercentDistance = 0.55,
        minMatchForPerson = 0.34,
        saveDelayMs = 5_000,
        minEyesDifference = 0.15,
        minDifForBlink = 0.3,
        blinkedEyesOpen = false,
        closeEyesThreshold = 0.2,
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
private val invalidValueException = IllegalArgumentException("Invalid value")

private val invalidNameException = IllegalArgumentException("Invalid setting name")

private fun parseInt(value: String, l: Int, r: Int) = try {
    val res = value.toInt()
    if (res !in l..r) {
        throw invalidValueException
    }
    res
} catch (_: NumberFormatException) {
    throw invalidValueException
}

private fun parseDouble(value: String, l: Double, r: Double) = try {
    val res = value.toDouble()
    if (res !in l..r) {
        throw invalidValueException
    }
    res
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

object SystemSettingsService {
    private val json = Json { prettyPrint = true }
    private var file by Delegates.notNull<File>()
    var systemSettings by Delegates.notNull<SystemSettings>()
        private set

    fun load(app: Application) {
        val dir = File(app.environment.config.property("settings.path").getString())
        dir.mkdirs()
        file = File(dir, app.environment.config.property("settings.file").getString())
        if (file.exists()) {
            systemSettings = try {
                json.decodeFromString<SystemSettings>(file.readText())
            } catch (_: IllegalArgumentException) {
                defaultSettings
            } catch (_: SerializationException) {
                defaultSettings
            } catch (e: Throwable) {
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
                            val session = call.getSession() ?: return@put
                            val upd = call.receiveOrRespond<SettingUpdate>() ?: return@put
                            val res = update(upd.name, upd.value)
                            if (res == UpdateSettingStatus.OK) {
                                session.log(AdminLogType.SETTINGS_CHANGE, "${upd.name} to ${upd.value}")
                                sysLog(SystemLogType.SETTINGS_CHANGE, "${upd.name} to ${upd.value}")
                            }
                            call.respond(res.statusCode, res.message)
                        }
                    }
                }
            }
        }
    }
}
