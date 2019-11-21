<script context="module">
  import anime from "animejs";
  const { stagger } = anime;
  
  export const animation = () => {
    return {
      targets: document.getElementsByClassName("boxgrid-anim"),
      easing: "easeInOutExpo",
    };
  };

  export const props = {
    minWidth: 50,
    maxWidth: 300,
    minHeight: 25,
    maxHeight: 50,
    xmargin: 0,
    ymargin: 0,
    text: "hello world",
    fontSize: 25,
    fontFamily: 'Roboto',
    position: "bottom",
    skew: 30
  };
</script>

<script>
  import { onMount, tick } from 'svelte';
  import Cheveron from '../shapes/cheveron.svelte';

  export let parentWidth;
  export let parentHeight;
  
  export let minWidth = props.minWidth; 
  export let maxWidth = props.maxWidth;
  export let minHeight = props.minHeight;
  export let maxHeight = props.maxHeight;
  export let text = props.text;
  export let fontSize = props.fontSize;
  export let fontFamily = props.fontFamily;
  export let position = props.position;
  export let xmargin = props.xmargin;
  export let ymargin = props.ymargin;
  export let skew = props.skew;

  let x = 0;
  let y = 0;
  let actualWidth = 0;
  let actualHeight = 0;

  let svgContainer;
  let textEl;
  
  let textXScale = 1;
  let textYScale = 1;

  const updatePosition = () => {
    if (position.includes("bottom")) {
      y = (parentHeight - actualHeight) - ymargin
    } else if (position.includes("top")) {
      y = ymargin
    } else {
      y = parentHeight / 2 - actualHeight / 2;
    }

    if (position.includes("right")) {
      x = (parentWidth - actualWidth) - xmargin
    } else if (position.includes("left")) {
      x = xmargin
    } else {
      x = parentWidth / 2 - actualWidth / 2 - skew;
    }
  }

  const updateSvgTextDimensions = () => {
    let BBox = textEl.getBBox();
    textXScale = 1;
    textYScale = 1;

    if (BBox.width > maxWidth) {
      actualWidth = maxWidth;
      textXScale = maxWidth/BBox.width;
    }
    else if (BBox.width < minWidth) actualWidth = minWidth;
    else actualWidth = BBox.width;

    if (BBox.height > maxHeight) {
      actualHeight = maxHeight;
      textYScale = maxHeight/BBox.height;
    }
    else if (BBox.height < minHeight) actualHeight = minHeight;
    else actualHeight = BBox.height;

    updatePosition(BBox);
  }

  // const updater = (node, value) => {
  //   return {
  //     async update(val) {
  //       updateSvgTextDimensions();
  //     },
  //   }
  // }

  onMount(() => updateSvgTextDimensions())

  $: if (textEl) (async () => {
    text, minWidth, maxWidth, position, xmargin, ymargin, minHeight, maxHeight, fontSize, skew
    await tick();
    updateSvgTextDimensions();
  })()
</script>

<svg 
  bind:this={svgContainer}
  x={x}
  y={y}
  width={actualWidth + parseInt(skew)*2} 
  height={actualHeight}
>
  <Cheveron 
    height={parseInt(actualHeight)} 
    width={parseInt(actualWidth) + parseInt(skew)} 
    skew={parseInt(skew)} 
    style="fill: #ddd;"
  />
  <text 
    bind:this={textEl} 
    id="anim-text" x="{skew}" y="{actualHeight - 5}" 
    style="
      font-family: {fontFamily}; 
      font-size: {fontSize};
      transform-origin: {skew}px {actualHeight-5}px;
      transform: scaleX({textXScale}) scaleY({textYScale});
    ">{text}</text>
</svg>