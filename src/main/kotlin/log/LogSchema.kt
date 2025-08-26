package com.batr.log

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.database.Database.suspendTransaction
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.withCharset
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.response.respondOutputStream
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.util.reflect.TypeInfo
import io.ktor.util.reflect.typeInfo
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.Op
import org.jetbrains.exposed.sql.Query
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import java.text.SimpleDateFormat
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
    protected val fetchLogType: (String) -> T,
) {
    fun load() {
        transaction {
            SchemaUtils.create(table)
        }
    }

    protected fun Route.configureLogManagers(logListTypeInfo: TypeInfo) {
        get {
            val download = call.request.queryParameters["download"].toBoolean()
            val logs = fetchLogs() ?: return@get
            if (!download) {
                call.respond(logs, logListTypeInfo)
                return@get
            }
            val fileName = logsFileName() ?: return@get

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
        get("current") {
            val now = System.currentTimeMillis()
            call.respond(getLogs(emptyList(), now - currentTimePeriodMs, now), logListTypeInfo)
        }

    }

    protected suspend fun RoutingContext.fetchLogType(): List<T>? = try {
        call.queryParameters["type"]?.split(",")?.map { fetchLogType(it) } ?: emptyList()
    } catch (_: IllegalArgumentException) {
        call.respond(HttpStatusCode.BadRequest, "Invalid type")
        null
    }

    protected suspend fun RoutingContext.fetchLogs(): List<L>? {
        val start = call.queryParameters["start"]?.toLong()
        val end = call.queryParameters["end"]?.toLong()
        val type = fetchLogType() ?: return null
        return getLogs(type, start, end)
    }

    protected suspend fun RoutingContext.logsFileName(): String? {
        val start = call.queryParameters["start"]?.toLong()
        val end = call.queryParameters["end"]?.toLong()
        val type = fetchLogType() ?: return null
        return "logs-[${start?.toDateString() ?: "start"} - ${end?.toDateString() ?: "end"}] [${
            if (type.isEmpty()) "all" else type.joinToString(",")
        }].txt"
    }


    protected abstract fun Query.toModel(): List<L>

    private fun time(start: Long?, end: Long?): Op<Boolean> =
        (if (start == null) Op.TRUE else table.time greaterEq start) and
                (if (end == null) Op.TRUE else table.time lessEq end)

    private fun type(type: List<T>): Op<Boolean> =
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