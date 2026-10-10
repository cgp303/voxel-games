

import type { IInvaderGroup } from '../../config/interfaces/interfaces';
import type { GroupType } from '../types/types';

const group2x2Grid: IInvaderGroup[] = [
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


const group3x3Grid: IInvaderGroup[] = [
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

const groupCrossesGrid: IInvaderGroup[] = [
    { group: ["1,0", "0,1", "1,1", "2,1", "1,2"], path: "left" },
    { group: ["4,0", "3,1", "4,1", "5,1", "4,2"], path: "center" }, // Dead center
    { group: ["7,0", "6,1", "7,1", "8,1", "7,2"], path: "right" },

    { group: ["1,3", "0,4", "1,4", "2,4", "1,5"], path: "left" },
    { group: ["4,3", "3,4", "4,4", "5,4", "4,5"], path: "center" }, // Dead center
    { group: ["7,3", "6,4", "7,4", "8,4", "7,5"], path: "right" }
];

const groupXsGrid: IInvaderGroup[] = [
    { group: ["0,0", "2,0", "1,1", "0,2", "2,2"], path: "left" },
    { group: ["3,0", "5,0", "4,1", "3,2", "5,2"], path: "center" }, // Dead center
    { group: ["6,0", "8,0", "7,1", "6,2", "8,2"], path: "right" },

    { group: ["0,3", "2,3", "1,4", "0,5", "2,5"], path: "left" },
    { group: ["3,3", "5,3", "4,4", "3,5", "5,5"], path: "center" }, // Dead center
    { group: ["6,3", "8,3", "7,4", "6,5", "8,5"], path: "right" }
];

const groupTsGrid: IInvaderGroup[] = [
    { group: ["0,0", "1,0", "2,0", "1,1", "1,2"], path: "left" },
    { group: ["3,0", "4,0", "5,0", "4,1", "4,2"], path: "center" }, // Dead center
    { group: ["6,0", "7,0", "8,0", "7,1", "7,2"], path: "right" },

    { group: ["0,3", "1,3", "2,3", "1,4", "1,5"], path: "left" },
    { group: ["3,3", "4,3", "5,3", "4,4", "4,5"], path: "center" }, // Dead center
    { group: ["6,3", "7,3", "8,3", "7,4", "7,5"], path: "right" }
];

const groupDiamondsGrid: IInvaderGroup[] = [
    { group: ["1,0", "0,1", "2,1", "1,2"], path: "left" },
    { group: ["4,0", "3,1", "5,1", "4,2"], path: "center" }, // Dead center
    { group: ["7,0", "6,1", "8,1", "7,2"], path: "right" },

    { group: ["1,3", "0,4", "2,4", "1,5"], path: "left" },
    { group: ["4,3", "3,4", "5,4", "4,5"], path: "center" }, // Dead center
    { group: ["7,3", "6,4", "8,4", "7,5"], path: "right" }
];


const group2x2V: IInvaderGroup[] = [
    { group: ["0,4", "1,4", "0,5", "1,5"], path: "left" },
    { group: ["2,4", "3,4", "2,5", "3,5"], path: "left" },
    { group: ["0,2", "1,2", "0,3", "1,3"], path: "left" },
    { group: ["2,2", "3,2", "2,3", "3,3"], path: "left" },
    { group: ["0,0", "1,0", "0,1", "1,1"], path: "left" },
    { group: ["2,0", "3,0", "2,1", "3,1"], path: "center" },
    { group: ["8,4", "9,4", "8,5", "9,5"], path: "right" },
    { group: ["6,4", "7,4", "6,5", "7,5"], path: "right" },
    { group: ["8,2", "9,2", "8,3", "9,3"], path: "right" },
    { group: ["6,2", "7,2", "6,3", "7,3"], path: "right" },
    { group: ["6,0", "7,0", "6,1", "7,1"], path: "center" },
    { group: ["8,0", "9,0", "8,1", "9,1"], path: "right" },
];

const group3x3V: IInvaderGroup[] = [
    { group: ["1,3", "2,3", "3,3", "1,4", "2,4", "3,4", "1,5", "2,5", "3,5"], path: "left" },
    { group: ["1,0", "2,0", "3,0", "1,1", "2,1", "3,1", "1,2", "2,2", "3,2"], path: "left" },
    { group: ["6,3", "7,3", "8,3", "6,4", "7,4", "8,4", "6,5", "7,5", "8,5"], path: "right" },
    { group: ["6,0", "7,0", "8,0", "6,1", "7,1", "8,1", "6,2", "7,2", "8,2"], path: "right" },
];

const groupCrossesV: IInvaderGroup[] = [
    { group: ["0,3", "0,4", "1,4", "2,4", "2,5"], path: "left" },
    { group: ["1,2", "1,3", "2,3", "3,3", "3,4"], path: "left" },
    { group: ["0,0", "0,1", "1,1", "2,1", "2,2"], path: "left" },
    { group: ["9,3", "7,4", "8,4", "9,4", "7,5"], path: "right" },
    { group: ["8,2", "6,3", "7,3", "8,3", "6,4"], path: "right" },
    { group: ["9,0", "7,1", "8,1", "9,1", "7,2"], path: "right" },
];

const groupDiamondsV: IInvaderGroup[] = [
    { group: ["1,1", "1,2", "2,2", "1,3", "2,3", "3,3", "2,4", "3,4", "3,5"], path: "left" },
    { group: ["8,1", "7,2", "8,2", "6,3", "7,3", "8,3", "6,4", "7,4", "6,5"], path: "right" },
    { group: ["0,4", "0,5", "1,5"], path: "left" },
    { group: ["3,1", "4,1", "4,2"], path: "center" },
    { group: ["9,4", "8,5", "9,5"], path: "right" },
    { group: ["5,1", "6,1", "5,2"], path: "center" },
];

const groupXsV: IInvaderGroup[] = [
    { group: ["0,3", "2,3", "2,4", "2,5", "4,5"], path: "left" },
    { group: ["7,3", "9,3", "7,4", "5,5", "7,5"], path: "right" },
    { group: ["0,0", "2,0", "2,1", "2,2", "4,2"], path: "left" },
    { group: ["7,0", "9,0", "7,1", "5,2", "7,2"], path: "right" },
];

const groupTsV: IInvaderGroup[] = [
    { group: ["2,4", "2,5", "3,5", "4,5"], path: "left" },
    { group: ["0,2", "0,3", "1,3", "2,3"], path: "left" },
    { group: ["1,1", "1,2", "2,2", "3,2"], path: "left" },
    { group: ["2,0", "2,1", "3,1", "4,1"], path: "center" },
    { group: ["7,0", "5,1", "6,1", "7,1"], path: "center" },
    { group: ["8,1", "6,2", "7,2", "8,2"], path: "right" },
    { group: ["9,2", "7,3", "8,3", "9,3"], path: "right" },
    { group: ["7,4", "5,5", "6,5", "7,5"], path: "right" },
];

const group2x2Diamond: IInvaderGroup[] = [
    { group: ["2,4", "3,4", "2,5", "3,5"], path: "left" },
    { group: ["4,4", "5,4", "4,5", "5,5"], path: "center" },
    { group: ["6,4", "7,4", "6,5", "7,5"], path: "right" },
    { group: ["0,2", "1,2", "0,3", "1,3"], path: "left" },
    { group: ["2,2", "3,2", "2,3", "3,3"], path: "left" },
    { group: ["4,2", "5,2", "4,3", "5,3"], path: "center" },
    { group: ["6,2", "7,2", "6,3", "7,3"], path: "right" },
    { group: ["8,2", "9,2", "8,3", "9,3"], path: "right" },
    { group: ["2,0", "3,0", "2,1", "3,1"], path: "left" },
    { group: ["4,0", "5,0", "4,1", "5,1"], path: "center" },
    { group: ["6,0", "7,0", "6,1", "7,1"], path: "right" },
];

const group3x3Diamond: IInvaderGroup[] = [
    { group: ["2,3", "3,3", "4,3", "2,4", "3,4", "4,4", "2,5", "3,5", "4,5"], path: "center" },
    { group: ["5,3", "6,3", "7,3", "5,4", "6,4", "7,4", "5,5", "6,5", "7,5"], path: "center" },
    { group: ["2,0", "3,0", "4,0", "2,1", "3,1", "4,1", "2,2", "3,2", "4,2"], path: "center" },
    { group: ["5,0", "6,0", "7,0", "5,1", "6,1", "7,1", "5,2", "6,2", "7,2"], path: "center" },
];
const groupCrossesDiamond: IInvaderGroup[] = [
    { group: ["2,3", "1,4", "2,4", "3,4", "2,5"], path: "left" },
    { group: ["7,3", "6,4", "7,4", "8,4", "7,5"], path: "right" },
    { group: ["1,1", "0,2", "1,2", "2,2", "1,3"], path: "left" },
    { group: ["8,1", "7,2", "8,2", "9,2", "8,3"], path: "right" },
    { group: ["3,0", "2,1", "3,1", "4,1", "3,2"], path: "center" },
    { group: ["6,0", "5,1", "6,1", "7,1", "6,2"], path: "center" },
];

const groupDiamond: IInvaderGroup[] = [
    { group: ["2,3", "4,3", "3,4", "2,5", "4,5"], path: "center" },
    { group: ["5,3", "7,3", "6,4", "5,5", "7,5"], path: "center" },
    { group: ["2,0", "4,0", "3,1", "2,2", "4,2"], path: "center" },
    { group: ["5,0", "7,0", "6,1", "5,2", "7,2"], path: "center" },
];

const groupTsDiamond: IInvaderGroup[] = [
    { group: ["3,3", "3,4", "2,5", "3,5", "4,5"], path: "center" },
    { group: ["6,3", "6,4", "5,5", "6,5", "7,5"], path: "center" },
    { group: ["3,0", "3,1", "2,2", "3,2", "4,2"], path: "center" },
    { group: ["6,0", "6,1", "5,2", "6,2", "7,2"], path: "center" },
    { group: ["1,1", "1,2", "0,3", "1,3", "2,3"], path: "left" },
    { group: ["8,1", "8,2", "7,3", "8,3", "9,3"], path: "right" },
];

const groupDiamondsDiamond: IInvaderGroup[] = [
    { group: ["3,1", "2,2", "3,2", "4,2", "1,3", "2,3", "3,3", "4,3", "5,3", "2,4", "3,4", "4,4", "3,5"], path: "center" },
    { group: ["7,0", "6,1", "7,1", "8,1", "5,2", "6,2", "7,2", "8,2", "9,2", "6,3", "7,3", "8,3", "7,4"], path: "right" },
];

// X formations
const group2x2X: IInvaderGroup[] = [
    { group: ["0,4", "1,4", "0,5", "1,5"], path: "left" },
    { group: ["2,4", "3,4", "2,5", "3,5"], path: "left" },
    { group: ["0,2", "1,2", "0,3", "1,3"], path: "left" },
    { group: ["2,2", "3,2", "2,3", "3,3"], path: "left" },
    { group: ["0,0", "1,0", "0,1", "1,1"], path: "left" },
    { group: ["2,0", "3,0", "2,1", "3,1"], path: "left" },
    { group: ["8,4", "9,4", "8,5", "9,5"], path: "right" },
    { group: ["6,4", "7,4", "6,5", "7,5"], path: "right" },
    { group: ["8,2", "9,2", "8,3", "9,3"], path: "right" },
    { group: ["6,2", "7,2", "6,3", "7,3"], path: "right" },
    { group: ["6,0", "7,0", "6,1", "7,1"], path: "right" },
    { group: ["8,0", "9,0", "8,1", "9,1"], path: "right" },
];


const group3x3X: IInvaderGroup[] = [
    { group: ["1,3", "2,3", "3,3", "2,4", "3,4", "4,4", "2,5", "3,5", "4,5"], path: "left" },
    { group: ["6,3", "7,3", "8,3", "5,4", "6,4", "7,4", "5,5", "6,5", "7,5"], path: "right" },
    { group: ["2,0", "3,0", "4,0", "2,1", "3,1", "4,1", "1,2", "2,2", "3,2"], path: "left" },
    { group: ["5,0", "6,0", "7,0", "5,1", "6,1", "7,1", "6,2", "7,2", "8,2"], path: "right" },
];

const groupCrossesX: IInvaderGroup[] = [
    { group: ["0,3", "0,4", "1,4", "2,4", "2,5"], path: "left" },
    { group: ["2,2", "1,3", "2,3", "3,3", "3,4"], path: "left" },
    { group: ["3,0", "1,1", "2,1", "3,1", "1,2"], path: "left" },
    { group: ["9,3", "7,4", "8,4", "9,4", "7,5"], path: "right" },
    { group: ["7,2", "6,3", "7,3", "8,3", "6,4"], path: "right" },
    { group: ["6,0", "6,1", "7,1", "8,1", "8,2"], path: "right" },
];

const groupXsX: IInvaderGroup[] = [
    { group: ["0,3", "2,3", "2,4", "2,5", "4,5"], path: "left" },
    { group: ["2,0", "4,0", "2,1", "0,2", "2,2"], path: "left" },
    { group: ["7,3", "9,3", "7,4", "5,5", "7,5"], path: "right" },
    { group: ["5,0", "7,0", "7,1", "7,2", "9,2"], path: "right" },
];

const groupTsX: IInvaderGroup[] = [
    { group: ["0,3", "1,4", "1,5", "2,5", "3,5"], path: "left" },
    { group: ["2,2", "2,3", "2,4", "3,4", "4,4"], path: "left" },
    { group: ["9,3", "8,4", "6,5", "7,5", "8,5"], path: "right" },
    { group: ["5,1", "6,2", "5,3", "6,3", "7,3"], path: "center" },
    { group: ["6,0", "7,1", "7,2", "8,2", "9,2"], path: "right" },
];

const groupDiamondsX: IInvaderGroup[] = [
    { group: ["1,3", "2,3", "1,4", "2,4", "3,4", "4,4", "3,5", "4,5"], path: "left" },
    { group: ["3,0", "4,0", "1,1", "2,1", "3,1", "4,1", "1,2", "2,2"], path: "left" },
    { group: ["7,3", "8,3", "5,4", "6,4", "7,4", "8,4", "5,5", "6,5"], path: "right" },
    { group: ["5,0", "6,0", "5,1", "6,1", "7,1", "8,1", "7,2", "8,2"], path: "right" },
];



// Change string[][] to InvaderGroup[]
export const groupAttackSets = new Map<GroupType, IInvaderGroup[]>([
    // Grid formations
    ["group2x2Grid", group2x2Grid],
    ["group3x3Grid", group3x3Grid],
    ["groupCrossesGrid", groupCrossesGrid],
    ["groupXsGrid", groupXsGrid],
    ["groupTsGrid", groupTsGrid],
    ["groupDiamondsGrid", groupDiamondsGrid],
    // V formations
    ["group2x2V", group2x2V],
    ["group3x3V", group3x3V],
    ["groupCrossesV", groupCrossesV],
    ["groupXsV", groupXsV],
    ["groupTsV", groupTsV],
    ["groupDiamondsV", groupDiamondsV],
    // Diamond formations
    ["group2x2Diamond", group2x2Diamond],
    ["group3x3Diamond", group3x3Diamond],
    ["groupCrossesDiamond", groupCrossesDiamond],
    ["groupXsDiamond", groupDiamond],
    ["groupTsDiamond", groupTsDiamond],
    ["groupDiamondsDiamond", groupDiamondsDiamond],
    // X formations
    ["group2x2X", group2x2X],
    ["group3x3X", group3x3X],
    ["groupCrossesX", groupCrossesX],
    ["groupXsX", groupXsX],
    ["groupTsX", groupTsX],
    ["groupDiamondsX", groupDiamondsX],
]);

// export const groupAttackSets = [groups2x2, groups3x3, groupCrosses, groupXs, groupTs, groupDiamonds] as const; 