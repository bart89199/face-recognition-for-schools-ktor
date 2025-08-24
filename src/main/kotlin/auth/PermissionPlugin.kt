package com.batr.auth

import com.batr.auth.session.getUserOrNull
import com.batr.auth.user.UserPermissions
import com.batr.auth.user.check
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createRouteScopedPlugin
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RouteSelector
import io.ktor.server.routing.RouteSelectorEvaluation
import io.ktor.server.routing.RoutingResolveContext

class RequirePermissionsConfig {
    var need: UserPermissions = UserPermissions()
    val noSessionRedirect: Boolean = true
    var onDenied: suspend ApplicationCall.() -> Unit = {
        respond(HttpStatusCode.Forbidden)
    }
}

val PermissionPlugin = createRouteScopedPlugin("PermissionPlugin", ::RequirePermissionsConfig) {
    val need = pluginConfig.need
    val deniedHandler = pluginConfig.onDenied
    val noSessionRedirect = pluginConfig.noSessionRedirect

    onCall { call ->
        val session = call.getSession(noSessionRedirect)
        val user = session?.getUserOrNull()
        val granted = (user?.permissions?.check(need) == true) or (user?.root == true)
        if (!granted) {
            deniedHandler(call)
        }
    }
}

class BlankRouteSelector(): RouteSelector() {
    override suspend fun evaluate(
        context: RoutingResolveContext,
        segmentIndex: Int
    ): RouteSelectorEvaluation {
        return RouteSelectorEvaluation.Transparent
    }

}

fun Route.setPermissions(permissions: UserPermissions, build: Route.() -> Unit) {
    val route = createChild(BlankRouteSelector())
    route.install(PermissionPlugin) {
        need = permissions
    }
    route.build()
}