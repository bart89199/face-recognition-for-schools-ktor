package com.batr.log

import com.batr.LiveMessages
import com.batr.auth.getSession
import com.batr.database.Database.suspendTransaction
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.withCharset
import io.ktor.server.response.respond
import io.ktor.server.response.respondOutputStream
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.websocket.webSocket
import io.ktor.util.reflect.TypeInfo
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.Op
import org.jetbrains.exposed.sql.Query
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import java.text.SimpleDateFormat
import kotlin.enums.enumEntries
import kotlin.reflect.KClass
import kotlin.text.split
import kotlin.text.toLong

abstract class LogModel<T : Enum<T>> {
    abstract val type: T
    abstract val time: Long
    abstract val message: String

    override fun toString(): String {
        return "[${time.toDateString()}] [$type]: $message"
    }
}

abstract class LogTable<T : Enum<T>>(typeClass: KClass<T>) : IntIdTable() {

    val type = enumeration("type", typeClass)
    val time = long("time")
    val message = text("message")
}

abstract class LogService<T : Enum<T>, L : LogModel<T>, LT : LogTable<T>>(
    protected val table: LT,
) {
    fun load() {
        transaction {
            SchemaUtils.create(table)
        }
    }

    protected val currentLogs: MutableList<L> = ArrayList()

    protected suspend inline fun <T : Enum<T>, reified L : LogModel<T>, LT : LogTable<T>> LogService<T, L, LT>.addLog(
        log: L
    ) {
        currentLogs.add(log)
        liveMassages.send(Json.encodeToString<L>(log))
        while (currentLogs.size >= currentLogAmount && currentLogAmount != -1) {
            currentLogs.removeFirst()
        }
    }

    protected val liveMassages = LiveMessages(currentLogAmount)

    protected inline fun <reified T : Enum<T>, reified L : LogModel<T>, LT : LogTable<T>> LogService<T, L, LT>.configureLogManagers(
        route: Route
    ): Unit = route.run {
        get {
            val session = call.getSession() ?: return@get
            val download = call.request.queryParameters["download"].toBoolean()
            val logs = fetchLogs(this) ?: return@get
            if (!download) {
                call.respond(logs)
                return@get
            }
            val fileName = (logsFileName(this) ?: return@get) + ".txt"
            session.log(AdminLogType.LOGS_DOWNLOAD, "Download $fileName")
            respondLogsFile(logs, fileName)
        }
        get("current") {
            val session = call.getSession() ?: return@get
            val download = call.request.queryParameters["download"].toBoolean()
            if (!download) {
                call.respond(currentLogs)
                return@get
            }
            val fileName = "[${System.currentTimeMillis().toDateString()}] current-logs.txt"
            session.log(AdminLogType.LOGS_DOWNLOAD, "Download current logs")
            respondLogsFile(currentLogs, fileName)
        }

        get("types") {
            call.respond(enumEntries<T>().map { it.name } )
        }

        webSocket("/ws") {
            liveMassages.register(this)
            try {
                for (frame in incoming) {
                    if (frame is Frame.Text) {
                        val t = frame.readText()
                        if (t.equals("ping", true)) {
                            send(Frame.Text("pong"))
                        }
                    }
                    if (frame is Frame.Close) {
                        liveMassages.unregister(this)
                        break
                    }
                }
            } finally {
                liveMassages.unregister(this)
            }
        }

    }

    protected suspend fun RoutingContext.respondLogsFile(logs: List<L>, fileName: String) {
        call.response.headers.append(
            HttpHeaders.ContentDisposition,
            ContentDisposition.Attachment
                .withParameter(ContentDisposition.Parameters.FileName, fileName)
                .toString()
        )
        call.response.headers.append(HttpHeaders.CacheControl, "no-store, no-cache, max-age=0")

        val newline = "\n".toByteArray()
        call.respondOutputStream(ContentType.Text.Plain.withCharset(Charsets.UTF_8)) {
            for (line in logs) {
                write(line.toString().toByteArray(Charsets.UTF_8))
                write(newline)
            }
            flush()
        }
    }

    protected suspend inline fun <reified T : Enum<T>> fetchLogType(
        routingContext: RoutingContext
    ): List<T>? = routingContext.run {
        try {
            call.queryParameters["type"]?.split(",")?.map { enumValueOf(it) } ?: emptyList()
        } catch (_: IllegalArgumentException) {
            call.respond(HttpStatusCode.BadRequest, "Invalid type")
            null
        }
    }


    protected suspend inline fun <reified T : Enum<T>, L : LogModel<T>, LT : LogTable<T>> LogService<T, L, LT>.fetchLogs(routingContext: RoutingContext): List<L>? = routingContext.run {
        val start = call.queryParameters["start"]?.toLong()
        val end = call.queryParameters["end"]?.toLong()
        val type = this@LogService.fetchLogType<T>(routingContext) ?: return null
        return getLogs(type, start, end).sortedByDescending { it.time }
    }

    protected suspend inline fun <reified T : Enum<T>, L : LogModel<T>, LT : LogTable<T>> LogService<T, L, LT>.logsFileName(routingContext: RoutingContext): String? = routingContext.run {
        val start = call.queryParameters["start"]?.toLong()
        val end = call.queryParameters["end"]?.toLong()
        val type = fetchLogType<T>(routingContext) ?: return null
        return "logs-[${start?.toDateString() ?: "start"} - ${end?.toDateString() ?: "end"}] [${
            if (type.isEmpty()) "all" else type.joinToString(",")
        }]"
    }


    protected abstract fun Query.toModel(): List<L>

    protected fun time(start: Long?, end: Long?): Op<Boolean> =
        (if (start == null) Op.TRUE else table.time greaterEq start) and
                (if (end == null) Op.TRUE else table.time lessEq end)

    protected fun type(type: List<T>): Op<Boolean> =
        if (type.isEmpty()) Op.TRUE else type.fold<T, Op<Boolean>>(Op.FALSE) { base, type ->
            base or (table.type eq type)
        }

    suspend fun getLogs(
        type: List<T> = emptyList(),
        start: Long? = null,
        end: Long? = null
    ): List<L> =
        suspendTransaction {
            table.selectAll().where(type(type) and time(start, end)).toModel()
        }

}

fun Long.toDateString(): String = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS").format(this)