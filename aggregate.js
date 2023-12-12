
const currentDate = new Date();
const formattedDate = formatDate(currentDate);

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

const moment = require('moment-timezone');
const timeZone = 'Asia/Kolkata';
const currentDateIST = moment().tz(timeZone);
currentDateIST.startOf('day');
const startTimeInSeconds = currentDateIST.unix();
currentDateIST.endOf('day');
const endTimeInSeconds = currentDateIST.unix();

module.exports = [
    {
        $group: {
            _id: {
                tenantId: {
                    $ifNull: ["$tenantId", "general tasks"],
                },
                status: "$status",
                user: "$assignedTo.name",
                // dueDate: "$dueDate",
            },

            count: {
                $sum: 1,
            },
            unassigned: {
                $sum: {
                    $cond: {
                        if: {
                            $ifNull: ["$assignedAt", false],
                        },
                        // {$eq:["$assignedAt",null],},
                        then: 0,
                        else: 1,
                    },
                },
            },
            //yesterday's start and end
            totalcreatedyesterday: {
                $sum: {
                    $cond: [
                        {
                            $and: [
                                {
                                    $gte: [
                                        "$createdAt",
                                        1702233000,
                                    ],
                                },
                                {
                                    $lte: [
                                        "$createdAt",
                                        1702319399,
                                    ],
                                },
                            ],
                        },
                        1,
                        0,
                    ],
                },
            },
            totalupdatedyesterday: {
                $sum: {
                    $cond: [
                        {
                            $and: [
                                {
                                    $gte: [
                                        "$updatedAt",
                                        1702233000,
                                    ],
                                },
                                {
                                    $lte: [
                                        "$updatedAt",
                                        1702319399,
                                    ],
                                },
                                {
                                    $gt: [
                                        {
                                            $size: "$logs",
                                        },
                                        1,
                                    ],
                                },
                            ],
                        },
                        1,
                        0,
                    ],
                },
            },
            duedate: {
                $sum: {
                    $cond: [
                        {
                            $and: [
                                {
                                    $lt: ["$dueDate", 20231212], //today's date
                                },
                                {
                                    $ne: ["$status", "done"],
                                },
                            ],
                        },
                        1,
                        0,
                    ],
                },
            },
        },
    },
    {
        $group: {
            _id: {
                tenantId: "$_id.tenantId",
            },
            statusArray: {
                $push: {
                    user: "$_id.user",
                    status: "$_id.status",
                    count: "$count",
                    overdue_user: "$duedate",
                },
            },
            unassignedCount: {
                $sum: "$unassigned",
            },
            totalcreatedyesterday: {
                $sum: "$totalcreatedyesterday",
            },
            totalupdatedyesterday: {
                $sum: "$totalupdatedyesterday",
            },
            overDue: {
                $sum: "$duedate",
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
        $unwind: "$statusArray",
    },
    {
        $group: {
            _id: {
                WorkspaceID: "$tenant.workspaceId",
                user: "$statusArray.user",
            },
            overdue_user: {
                $sum: "$statusArray.overdue_user",
            },
            unassignedCount: {
                $first: "$unassignedCount",
            },
            totalcreatedyesterday: {
                $first: "$totalcreatedyesterday",
            },
            totalupdatedyesterday: {
                $first: "$totalupdatedyesterday",
            },
            overDueOverall: {
                $first: "$overDue",
            },
            status: {
                $addToSet: "$statusArray",
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
            overdue_user: 1,
            unassignedCount: 1,
            totalcreatedyesterday: 1,
            totalupdatedyesterday: 1,
            overDueOverall: 1,
            status: {
                $arrayToObject: {
                    $map: {
                        input: "$status",
                        as: "statusItem",
                        in: {
                            k: "$$statusItem.status",
                            v: "$$statusItem.count",
                        },
                    },
                },
            },
        },
    },
];
