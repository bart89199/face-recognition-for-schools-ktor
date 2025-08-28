package com.batr

import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.websocket.Frame
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.ConcurrentHashMap

private const val HISTORY_LIMIT = 50

class LiveMessages {

    private val sessions = ConcurrentHashMap.newKeySet<DefaultWebSocketServerSession>()
    private val history = ArrayDeque<String>(HISTORY_LIMIT)
    private val historyLock = Mutex()

    suspend fun send(text: String) {
        historyLock.withLock {
            if (history.size == HISTORY_LIMIT) history.removeFirst()
            history.addLast(text)
        }
        val frame = Frame.Text(text)
        sessions.forEach { s ->
            runCatching { s.send(frame) }
        }
    }

    suspend fun register(session: DefaultWebSocketServerSession) {
        sessions.add(session)
        val snapshot = historyLock.withLock { history.toList() }
        for (h in snapshot) {
            runCatching { session.send(Frame.Text(h)) }
        }
    }

    fun unregister(session: DefaultWebSocketServerSession) {
        sessions.remove(session)
    }
}