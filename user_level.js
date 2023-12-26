const moment = require('moment-timezone');
const timeZone = 'Asia/Kolkata';
const currentDateIST = moment().tz(timeZone);
const previousDay = currentDateIST.clone().subtract(1, 'day');
previousDay.startOf('day');
const startTimeInSeconds = previousDay.unix();
previousDay.endOf('day');
const endTimeInSeconds = previousDay.unix();
// const startTimeInSeconds = 1703269800
// const endTimeInSeconds = 1703356199


module.exports = [
    {
        $unwind: "$logs",
    },
    {
        $match: {
            "logs.createdAt": {
                $gte: startTimeInSeconds,
                $lte: endTimeInSeconds,
            },

        },
    },
    {
        $addFields: {
            isCreated: {
                $eq: ["$logs.action", "created"],
            },
            updatedKeys: {
                $size: {
                    $setDifference: [
                        {
                            $objectToArray: {
                                $ifNull: [
                                    "$logs.changeLogs.from",
                                    {},
                                ],
                            },
                        },
                        {
                            $objectToArray: {
                                $ifNull: [
                                    "$logs.changeLogs.to",
                                    {},
                                ],
                            },
                        },
                    ],
                },
            },
        },
    },
    {
        $group: {
            _id: {
                tenantId: {
                    $ifNull: ["$tenantId", "general tasks"],
                },
                status: "$status",
                user: "$assignedTo.name",
            },
            updatedKeys: {
                $sum: "$updatedKeys",
            },
            createdCount: {
                $sum: {
                    $cond: [
                        {
                            $and: [
                                "$isCreated",
                                {
                                    $gte: [
                                        "$logs.createdAt",
                                        startTimeInSeconds,
                                    ],
                                },
                                {
                                    $lte: [
                                        "$logs.createdAt",
                                        endTimeInSeconds,
                                    ],
                                },
                            ],
                        },
                        1,
                        0,
                    ],
                },
            },
            logs: {
                $push: {
                    logs: "$$ROOT.logs",
                },
            },

        },
    },
    {
        $group: {
            _id: {
                tenantId: "$_id.tenantId",
            },

            updateArray: {
                $push: {
                    user: "$_id.user",
                    updatedKeys: "$updatedKeys",
                    createdCount: "$createdCount",
                },
            },


        },
    },
    {
        $lookup: {
            from: "tenants",
            localField: "_id.tenantId",
            foreignField: "_id",
            as: "tenant",
        },
    },
    {
        $unwind: "$updateArray",
    },
    {
        $group: {
            _id: {
                WorkspaceID: "$tenant.workspaceId",
                user: "$updateArray.user",
            },
            updatedKeys_user: {
                $sum: "$updateArray.updatedKeys",
            },
            createdCount_user: {
                $sum: "$updateArray.createdCount",
            },

        },
    },
    {
        $project: {
            _id: 0,
            WorkspaceID: {
                $ifNull: [
                    {
                        $arrayElemAt: ["$_id.WorkspaceID", 0],
                    },
                    "general tasks",
                ],
            },
            user: {
                $ifNull: ["$_id.user", "unassigned"],
            },
            updatedKeys_user: 1,
            createdCount_user: 1,
        },
    },
]