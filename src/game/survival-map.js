import nav from '../data/survival-navigation.json' with {type:'json'};
import {createNavigation} from './navigation-grid.js';
export const survivalNavigation=createNavigation(nav,{spawn:[-12,20],objective:[-12,12],entries:[[-26,0],[-3,0],[-28,20],[3,20],[-12,-2]]});
