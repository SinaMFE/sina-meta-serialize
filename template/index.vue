<template>
    <section class="top_card" :class="[isVideo && 'video_card'  , cardType()]">
        <section class="tcard_main">
            <h2 class="tcard_title">{{title}}</h2>
            <section class="tcard_imgs">
                <img v-for="(img , index) in posters" :key="img + index" class="tcard_poster" :src="img">
            </section>
        </section>
        <h4 class="tcard_subtitle d_r">
            <p class="tcard_source">{{subTitle}}</p>
            <p class="tcard_time">{{time}}</p>
        </h4>
    </section>
</template>

<script lang="ts">
import { inputType } from "@mfelibs/supercomp-property-decorator/lib/design/inputType";
import { SPComponent } from "@mfelibs/super-atom-component";
import {
  Component,
  Prop,
  Watch,
  Design,
  dataSource,
  dataSourceType,
  dataSourceManager,
  remoteDataSource,
  remoteDataSourceConf
} from "@mfelibs/supercomp-property-decorator";
import "@mfelibs/base-css";
import "./cardStyle.css";

enum inputType {
  text = "4"
}

@dataType({
  code: "model.link"
})
export class Link {
  web_url?: string;
  hb_url?: string;
}

@Maybe({
  code: "dsjk"
})
class Hapi {
  private name: string;
}

@Component({})
export default class Card extends SPComponent {
  @Design({
    label: "title",
    dataType: Link,
    inputType: inputType.text,
    description: "card 的title"
  })
  @Prop({})
  title!: string;

  @Design({
    label: "副标题",
    dataType: String,
    inputType: inputType.text,
    description: "card的副标题"
  })
  @Prop({})
  subTitle!: string;

  @Prop({})
  time!: string;

  @Design({
    label: "副标题",
    dataType: String,
    inputType: inputType.text,
    description: "card的副标题"
  })
  posters!: Array<string>;

  @Design({
    label: "是否是视频",
    dataType: Boolean,
    inputType: inputType.text,
    description: "如果是视频，则选择是，否则选择否"
  })
  @Prop({})
  isVideo!: boolean;
  private cardType() {
    return this.posters.length == 1 ? "single" : "three";
  }

  mounted() {
    console.log("mounted");
  }

  created() {
    console.log("created");
  }
}

</script>

<style>

</style>
