<template>
  <main>
    <FlowchartView />
  </main>
</template>

<script>
import FlowchartView from '@/components/FlowchartView.vue';

export default {
  name: 'App',

  components: {
    FlowchartView
  }
}
</script>

<style lang="scss">
@import '@/assets/normalize.css';

#app {
  
}
</style>
