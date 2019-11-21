import * as BGrid from "./animations/BoxGrid.svelte";
import * as LThird from "./animations/LowerThird.svelte";

export default {
  "box grid": {
    component: BGrid.default,
    animation: BGrid.animation,
    props: BGrid.props
  },
  "lower third": {
    component: LThird.default,
    animation: LThird.animation,
    props: LThird.props
  }
};
