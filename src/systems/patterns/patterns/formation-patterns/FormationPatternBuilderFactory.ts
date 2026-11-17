import { IFormationPatternBuilder } from '../../../../config/interfaces/interfaces';
import { SimpleLoopFormationPatternBuilder } from './SimpleLoopFormationPatternBuilder';
import { SimpleLoopFormationPatternBuilder2 } from './SimpleLoopFormationPatternBuilder2';
import { Level4LoopFormationPatternBuilder } from './Level4LoopFormationPatternBuilder';

// export enum FormationPatternBuilderType {
//     SimpleLoop = 'simpleLoop',
//     // Add more builder types here as you create them
// }

export class FormationPatternBuilderFactory {
    static create(type: string): IFormationPatternBuilder {
        switch (type) {
            case 'simpleLoop':
                return new SimpleLoopFormationPatternBuilder();
            case 'simpleLoop2':
                return new SimpleLoopFormationPatternBuilder2();
            case 'level4Loop':
                return new Level4LoopFormationPatternBuilder();
            default:
                return new SimpleLoopFormationPatternBuilder();
        }
    }
}