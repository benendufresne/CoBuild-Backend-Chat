"use strict";

/**
 * v1 routes
 */

// admin routes
import { userRoute as userRouteV1 } from "@modules/user/v1/UserRoute";
import { chatRoute as chatRouteV1 } from "@modules/chat/v1/ChatRoute"

export const routes: any = [
    ...userRouteV1,
    ...chatRouteV1
];
