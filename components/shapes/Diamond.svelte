<script>
  export let width;
  export let height;
  export let midPoint;
  export let style;
</script>

<path 
  d="
    M 0 {height * midPoint}
    L {width / 2} 0
    L {width} {height * midPoint}
    L {width / 2} {height}
    L 0 {height * midPoint}
    Z
  "
  {style}
/>