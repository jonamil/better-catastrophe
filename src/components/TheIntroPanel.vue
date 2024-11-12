<template>
  <PrimaryButton
    class="open"
    icon="info"
    title="Einleitung öffnen"
    :tabindex="viewStore.introPanelVisible ? -1 : ''"
    @click="$emit('toggleIntroPanel')"
  />
  <div ref="intro" class="intro" :class="{ visible: viewStore.introPanelVisible }">
    <div class="outer">
      <div class="inner">
        <div class="languages">
          <a
            v-for="(language, index) in languages"
            :key="index"
            :class="{ active: flowchartLanguage === language.id }"
            :href="flowchartLanguage !== language.id ? language.path : undefined"
          >
            {{ language.label }}
          </a>
        </div>
        <h1>I Want A Better Catastrophe</h1>
        <h2>Flowchart für einen Weg durch unser Klima-Dilemma</h2>
        <p>Die Erderwärmung wird allen Vorhersagen nach weit an der 1,5°C-Grenze vorbeischießen. Gestürzt in eine Hoffnungskrise begibt sich der lebenslange Aktivist <a href="https://bettercatastrophe.com/" target="_blank">Andrew Boyd</a> auf die Suche nach Wegen, wie sich mit dem »unmöglichen« Ausblick des Klimazusammenbruchs leben lässt. Mit düsterem Humor und gebrochenem Herzen leitet uns Andrew durch unsere Ängste, während er seine eigenen verarbeitet. Dieses Flowchart (und <a href="https://bettercatastrophe.com/" target="_blank">das Buch</a>, in dem es ursprünglich erschien) ist eine Einladung, Andrew auf seinem Weg zu begleiten sowie unser kollektives Dilemma selbstständig zu erkunden.</p>
        <div class="instructions">
          <img src="@/assets/modes.svg" @click="$emit('togglePlayback')" />
          <div v-if="resetActionAvailable" class="reset">
            <span>Nochmal von Anfang an erkunden?</span>
            <button @click="clearStorageKeyAndReload()">Zurücksetzen und neu starten</button>
          </div>
        </div>
        <h3>Bedienung</h3>
        <p>Drücke am unteren Rand auf den Play-Button, um Andrews Erläuterungen des Flowcharts zu starten (oder zu pausieren). Du kannst das Chart auch selbst erkunden, indem du sichtbare Elemente anklickst und dich so Stück für Stück voran bewegst. Dieser experimentelle Bedienungsansatz verfolgt das Ziel, das Flowchart als verbreitetes Medium des Informationsdesigns neu zu denken, indem er Narration und Interaktivität integriert.</p>
        <h3>Hintergrund</h3>
        <p>Die originale, englische Version des Flowcharts ist als ausfaltbare Seite in Andrews neuem Buch <a href="https://bettercatastrophe.com/" target="_blank">»I Want a Better Catastrophe«</a> enthalten:</p>
        <a href="https://bettercatastrophe.com/" target="_blank">
          <img src="@/assets/book.png" />
        </a>
        <h3>Deutsche Ausgabe</h3>
        <p>Die Veröffentlichung einer deutschen Übersetzung wurde möglich gemacht durch das <a href="https://endspiel.website/" target="_blank">Projekt »Klima-Endspiel«</a>. Das interaktive Flowchart sowie ein begleitender Artikel von Andrew Boyd sind als Teil der Plattform und Publikation <a href="https://endspiel.website/" target="_blank">XYZ</a> erschienen.</p>
        <h3>Credits</h3>
        <p>
          <strong><a href="https://bettercatastrophe.com/" target="_blank">Andrew Boyd</a></strong>
          Buch und englisches Original-Flowchart
          <strong><a href="https://molochronikhome.wordpress.com/" target="_blank">Alex »molosovsky«</a></strong>
          Deutsche Übersetzung von Flowchart und Audio‑Narration
          <strong><a href="https://zeit.de/autoren/F/Moses_Fendel/index" target="_blank">Moses Fendel</a></strong>
          Stimme der deutschen Audio-Narration
          <strong><a href="https://endspiel.website/" target="_blank">Projekt »Klima-Endspiel«</a></strong>
          Herausgeberschaft der deutschen Ausgabe
          <strong><a href="https://jona.im/" target="_blank">Jona Pomerance</a></strong>
          Gestaltung, Prototyping und Entwicklung des interaktiven Flowcharts
          <strong><a href="https://mariandoerk.de/" target="_blank">Marian Dörk</a></strong>
          Forschungsbegleitung
        </p>
        <h3>Template</h3>
        <p>Dieses Projekt basiert auf dem <a href="https://uclab.fh-potsdam.de/interactive-flowchart/" target="_blank">Interactive-Flowchart</a>-Template, mit dem Interaktivität und Audio-Narration auch zu anderen Flowcharts hinzugefügt werden können.</p>
        <div class="logos">
          <a href="https://www.fh-potsdam.de/" target="_blank"><img src="@/assets/fhp.svg" /></a>
          <a href="https://uclab.fh-potsdam.de/" target="_blank"><img src="@/assets/uclab.svg" /></a>
        </div>
        <p>
          <a href="mailto:endspiel@meteo.uni-hannover.de,hello@jona.im,marian.doerk@fh-potsdam.de?subject=I%20Want%20a%20Better%20Catastrophe%20Flowchart">Kontakt</a> &nbsp;·&nbsp;
          <a href="https://www.fh-potsdam.de/impressum" target="_blank">Impressum</a> &nbsp;·&nbsp;
          <a href="https://www.fh-potsdam.de/datenschutz" target="_blank">Datenschutz</a>
        </p>
      </div>
    </div>
    <button class="close" title="Einleitung schließen" @click="$emit('toggleIntroPanel')"></button>
  </div>
</template>

<script>
import { mapStores, mapState, mapWritableState, mapActions } from 'pinia';

import PrimaryButton from '@/components/PrimaryButton.vue';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';
import { useViewStore } from '@/stores/ViewStore.js';

import languages from '@/data/languages.json';

export default {
  name: 'TheIntroPanel',

  components: {
    PrimaryButton
  },

  emits: [
    'togglePlayback',
    'toggleIntroPanel'
  ],

  data() {
    return {
      languages,
      resetAppearanceDelay: 500
    }
  },
  
  computed: {
    ...mapStores(
      useViewStore
    ),
    ...mapState(useFlowchartStore, [
      'flowchartLanguage',
      'currentNodeId'
    ]),
    ...mapWritableState(useFlowchartStore, [
      'resetActionAvailable'
    ])
  },

  methods: {
    ...mapActions(useFlowchartStore, [
      'clearStorageKeyAndReload'
    ])
  },

  watch: {
    // when the node ID changes for the first time, unhide reset prompt
    currentNodeId() {
      if (!this.resetActionAvailable) {
        setTimeout(() => {
          this.resetActionAvailable = true;
        }, this.resetAppearanceDelay);
      }
    },
    // make interactive elements non-keyboard-selectable when intro panel is hidden
    'viewStore.introPanelVisible'() {
      if (this.viewStore.introPanelVisible) {
        this.$refs.intro.querySelectorAll('a, button').forEach(element => {
          element.removeAttribute('tabindex');
        });
      } else {
        this.$refs.intro.querySelectorAll('a, button').forEach(element => {
          element.setAttribute('tabindex', -1);
        });
      }
    }
  }
}
</script>

<style lang="scss">
@import '@/assets/variables.css';

:root {
  --panel-width: 416px;
}

button.open {
  position: absolute;
  top: 16px;
  left: 16px;
  box-shadow: 0 0 0 2px var(--background-color);
}

.intro {
  position: absolute;
  z-index: 100;
  overflow: hidden;
  top: 0;
  bottom: 0;
  left: 0;
  width: 0;
  color: rgba(255,255,255,0.9);
  background: var(--intro-background-color);
  transition: width var(--transition-duration-long) var(--transition-timing);

  &.visible {
    width: var(--panel-width);

    // &:after {
    //   opacity: 1;
    // }

    .inner > *, .inner .instructions *:not(.reset) {
      opacity: 1;
    }
  }

  &:before/*, &:after*/ {
    position: absolute;
    display: block;
    content: '';
    left: 0;
    width: var(--panel-width);
    pointer-events: none;
  }

  &:before {
    z-index: 1;
    bottom: 0;
    height: 224px;
    background:
      linear-gradient(180deg, transparent 0%, var(--intro-background-color) 100%),
      linear-gradient(180deg, transparent 0%, var(--intro-background-color) 100%),
      linear-gradient(180deg, transparent 0%, var(--intro-background-color) 100%);
  }

  // &:after {
  //   z-index: 2;
  //   opacity: 0;
  //   bottom: 80px;
  //   height: 340px;
  //   background-size: var(--panel-width);
  //   background-position: center bottom;
  //   background-repeat: no-repeat;
  //   background-image: url('@/assets/tentacles.png');
  //   transition: opacity var(--transition-duration-long) var(--transition-timing);
  // }

  *::selection {
    color: #fff;
    background: rgb(var(--accent-color));
  }

  .outer {
    position: absolute;
    overflow-y: auto;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
  }

  .inner {
    position: relative;
    width: var(--panel-width);
    padding: 16px 28px 224px;
    box-sizing: border-box;

    > *, .instructions *:not(.reset) {
      opacity: 0;
      transition: opacity var(--transition-duration-long) var(--transition-timing);
    }

    > a {
      display: block;
      margin: 20px 0 40px;

      img {
        width: 100%;
        height: 224px;
        object-fit: contain;
      }
    }
  }

  .languages {
    display: inline-block;
    margin-left: -2px;
    border-radius: 64px;
    background-color: rgba(111,111,111,0.75);
    transition:
      opacity var(--transition-duration-long) var(--transition-timing),
      background var(--transition-duration) var(--transition-timing);

    a {
        display: inline-block;
        box-sizing: border-box;
        height: 32px;
        padding: 7px 16px;
        font-weight: 600;
        text-decoration: none;
        border-radius: 64px;
        
        color: #fff;
        
        &:hover {
          color: inherit;
        }

        &:not(.active):focus-visible {
          background: unset;
        }

        &.active {
          color: var(--background-color);
          background-color: #fff;
        }
    }

    &:has(a:not(.active):hover) {
      background-color: rgba(111,111,111,0.95);
    }
  }

  h1 {
    max-width: 284px;
    margin: 22px 0 0;
    font-size: 30px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  h2 {
    max-width: 256px;
    margin: 6px 0 20px;
    font-size: 20px;
    font-weight: 400;
  }

  h3 {
    margin: 24px 0 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  p {
    margin: 12px 0;
    font-family: 'Vesper Libre', serif;
    font-size: 16px;
    line-height: 1.3;

    strong {
      display: block;
      margin: 8px 0 0;
    }
  }

  a {
    color: inherit;
    text-decoration-color: rgba(var(--accent-color), 0.6);
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
    transition: color var(--transition-duration) var(--transition-timing);

    &:hover {
      color: rgb(var(--accent-color));
    }
  }

  .instructions {
    position: relative;
    display: grid;
    align-items: start;
    opacity: 1 !important;
    margin: 20px 0 72px;

    > * {
      grid-column-start: 1;
      grid-row-start: 1;
    }

    img {
      display: block;
      width: 100%;
      max-width: 290px;
      margin: 0 auto;
    }

    .reset {
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      min-height: 118px;
      margin: 2px -12px 0 -12px;
      padding: 16px 24px 20px;
      text-align: center;
      text-wrap: balance;
      line-height: 1.25;
      border-radius: 8px;
      background: rgba(255,255,255,0.08);
      -webkit-backdrop-filter: blur(24px);
      backdrop-filter: blur(24px);

      button {
        display: block;
        margin: 12px auto 2px;
        padding: 8px 16px;
        appearance: none;
        font-weight: 600;
        border: none;
        border-radius: 64px;
        color: #fff;
        background: rgb(var(--accent-color));
        cursor: pointer;
        transition: opacity var(--transition-duration-long) var(--transition-timing), transform var(--transition-duration) var(--transition-timing) !important;

        &:hover {
          transform: scale(1.0625);
        }
      }
    }
  }

  .logos {
    display: flex;
    align-items: top;
    gap: 32px;
    margin: 58px 0 -8px;

    a {
      flex: 1;
      transition: opacity var(--transition-duration) var(--transition-timing);

      &:first-child {
        flex-basis: 25%;
      }

      &:hover {
        opacity: 0.65;
      }

      img {
        width: 100%;
      }
    }
  }

  button.close {
    position: absolute;
    opacity: 0;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    padding: 0;
    appearance: none;
    border: none;
    border-radius: 100%;
    background-position: center;
    background-image: url('@/assets/icons/close.svg');
    background-color: rgba(111,111,111,0.75);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    cursor: pointer;
    transition-property: opacity, transform, box-shadow;
    transition-duration: var(--transition-duration-long), var(--transition-duration), var(--transition-duration);
    transition-timing-function: var(--transition-timing);

    &:hover {
      transform: scale(1.125);
    }

    @at-root .intro.visible button.close {
      opacity: 1;
    }
  }

  *:focus-visible {
    position: relative;
    background: var(--intro-background-color);
    box-shadow: 0 0 0 2px var(--intro-background-color), 0 0 0 4px var(--focus-color) !important;
  }
}

@media (max-width: 600px) {
  .intro.visible,
  .intro:before,
  .intro:after,
  .intro .inner {
    width: 100vw;
  }
}

// @media (max-height: 650px) {
//   .intro:before {
//     height: 33vh;
//   }
  
//   .intro:after {
//     display: none;
//   }

//   .intro .inner {
//     padding-bottom: 33vh;
//   }
// }
</style>