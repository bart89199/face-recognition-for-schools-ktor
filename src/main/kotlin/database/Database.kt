package com.batr.database

import com.batr.getEnvOrEnvFile
import com.batr.getEnvOrEnvFileOrDef
import com.batr.getEnvOrEnvFileOrNull
import io.ktor.server.application.*
import org.jetbrains.exposed.v1.jdbc.Database

object Database {
//    suspend fun <T> suspendTransaction(block: Transaction.() -> T): T =
//        org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction(statement = block)

    fun Application.configureDatabase() {
        Database.connect(
            "jdbc:postgresql://" + getEnvOrEnvFileOrDef("DB_URL", "localhost:5432") + "/" + getEnvOrEnvFileOrDef("POSTGRES_DB", "face-recognition"),
            user = getEnvOrEnvFileOrDef("DB_USER", "postgres"),
            password = getEnvOrEnvFileOrDef("DB_PASSWORD", "password")
        )

    }
}