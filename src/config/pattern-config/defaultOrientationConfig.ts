import { IOrientationConfig } from '../interfaces/interfaces';
import { ENTRY } from '../data/constants';

export const defaultOrientationConfig: IOrientationConfig = {
    bankGain: ENTRY.bankGain,
    maxBankRad: ENTRY.maxBankRad,
    orientSmooth: ENTRY.orientSmooth,
    dockSmooth: ENTRY.dockSmooth,
    debugForwardArrow: ENTRY.debugForwardArrow,
};

