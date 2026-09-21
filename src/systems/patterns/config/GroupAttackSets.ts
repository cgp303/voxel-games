type MovementPath = "left" | "right" | "center";

export interface InvaderGroup {
    group: string[];
    path: MovementPath;
}

const groups2x2: InvaderGroup[] = [
    // Row block 0
    { group: ["0,0", "1,0", "0,1", "1,1"], path: "left" },
    { group: ["2,0", "3,0", "2,1", "3,1"], path: "left" },
    { group: ["4,0", "5,0", "4,1", "5,1"], path: "center" }, // Center-left split
    { group: ["6,0", "7,0", "6,1", "7,1"], path: "right" },
    { group: ["8,0", "9,0", "8,1", "9,1"], path: "right" },

    // Row block 1
    { group: ["0,2", "1,2", "0,3", "1,3"], path: "left" },
    { group: ["2,2", "3,2", "2,3", "3,3"], path: "left" },
    { group: ["4,2", "5,2", "4,3", "5,3"], path: "center" }, // Center-left split
    { group: ["6,2", "7,2", "6,3", "7,3"], path: "right" },
    { group: ["8,2", "9,2", "8,3", "9,3"], path: "right" },

    // Row block 2
    { group: ["0,4", "1,4", "0,5", "1,5"], path: "left" },
    { group: ["2,4", "3,4", "2,5", "3,5"], path: "left" },
    { group: ["4,4", "5,4", "4,5", "5,5"], path: "center" }, // Center-left split
    { group: ["6,4", "7,4", "6,5", "7,5"], path: "right" },
    { group: ["8,4", "9,4", "8,5", "9,5"], path: "right" }
];

const groups3x3: InvaderGroup[] = [
    // Row block 0
    {
        group: [
            "0,0", "1,0", "2,0",
            "0,1", "1,1", "2,1",
            "0,2", "1,2", "2,2"
        ],
        path: "left"
    },
    {
        group: [
            "3,0", "4,0", "5,0",
            "3,1", "4,1", "5,1",
            "3,2", "4,2", "5,2"
        ],
        path: "center" // Dead center group (Mean X: 4)
    },
    {
        group: [
            "6,0", "7,0", "8,0",
            "6,1", "7,1", "8,1",
            "6,2", "7,2", "8,2"
        ],
        path: "right"
    },

    // Row block 1
    {
        group: [
            "0,3", "1,3", "2,3",
            "0,4", "1,4", "2,4",
            "0,5", "1,5", "2,5"
        ],
        path: "left"
    },
    {
        group: [
            "3,3", "4,3", "5,3",
            "3,4", "4,4", "5,4",
            "3,5", "4,5", "5,5"
        ],
        path: "center" // Dead center group (Mean X: 4)
    },
    {
        group: [
            "6,3", "7,3", "8,3",
            "6,4", "7,4", "8,4",
            "6,5", "7,5", "8,5"
        ],
        path: "right"
    }
];

const groupCrosses: InvaderGroup[] = [
    { group: ["1,0", "0,1", "1,1", "2,1", "1,2"], path: "left" },
    { group: ["4,0", "3,1", "4,1", "5,1", "4,2"], path: "center" }, // Dead center
    { group: ["7,0", "6,1", "7,1", "8,1", "7,2"], path: "right" },

    { group: ["1,3", "0,4", "1,4", "2,4", "1,5"], path: "left" },
    { group: ["4,3", "3,4", "4,4", "5,4", "4,5"], path: "center" }, // Dead center
    { group: ["7,3", "6,4", "7,4", "8,4", "7,5"], path: "right" }
];

const groupXs: InvaderGroup[] = [
    { group: ["0,0", "2,0", "1,1", "0,2", "2,2"], path: "left" },
    { group: ["3,0", "5,0", "4,1", "3,2", "5,2"], path: "center" }, // Dead center
    { group: ["6,0", "8,0", "7,1", "6,2", "8,2"], path: "right" },

    { group: ["0,3", "2,3", "1,4", "0,5", "2,5"], path: "left" },
    { group: ["3,3", "5,3", "4,4", "3,5", "5,5"], path: "center" }, // Dead center
    { group: ["6,3", "8,3", "7,4", "6,5", "8,5"], path: "right" }
];

const groupTs: InvaderGroup[] = [
    { group: ["0,0", "1,0", "2,0", "1,1", "1,2"], path: "left" },
    { group: ["3,0", "4,0", "5,0", "4,1", "4,2"], path: "center" }, // Dead center
    { group: ["6,0", "7,0", "8,0", "7,1", "7,2"], path: "right" },

    { group: ["0,3", "1,3", "2,3", "1,4", "1,5"], path: "left" },
    { group: ["3,3", "4,3", "5,3", "4,4", "4,5"], path: "center" }, // Dead center
    { group: ["6,3", "7,3", "8,3", "7,4", "7,5"], path: "right" }
];

const groupDiamonds: InvaderGroup[] = [
    { group: ["1,0", "0,1", "2,1", "1,2"], path: "left" },
    { group: ["4,0", "3,1", "5,1", "4,2"], path: "center" }, // Dead center
    { group: ["7,0", "6,1", "8,1", "7,2"], path: "right" },

    { group: ["1,3", "0,4", "2,4", "1,5"], path: "left" },
    { group: ["4,3", "3,4", "5,4", "4,5"], path: "center" }, // Dead center
    { group: ["7,3", "6,4", "8,4", "7,5"], path: "right" }
];


export type GroupType =
    | "groups2x2"
    | "groups3x3"
    | "groupCrosses"
    | "groupXs"
    | "groupTs"
    | "groupDiamonds";

// Change string[][] to InvaderGroup[]
export const groupAttackSets = new Map<GroupType, InvaderGroup[]>([
    ["groups2x2", groups2x2],
    ["groups3x3", groups3x3],
    ["groupCrosses", groupCrosses],
    ["groupXs", groupXs],
    ["groupTs", groupTs],
    ["groupDiamonds", groupDiamonds],
]);

// export const groupAttackSets = [groups2x2, groups3x3, groupCrosses, groupXs, groupTs, groupDiamonds] as const; 