<template>
    <section>
        <!-- <sign-up :poster="poster"></sign-up> -->
    </section>
</template>

<script lang="ts">
import { SPComponent } from '@mfelibs/super-atom-component';
import {
  Component,
  Prop,
  Watch,
  dataSource,
  dataSourceType,
  dataSourceManager,
  remoteDataSource,
  remoteDataSourceConf,
  sPageMixin,
} from '@mfelibs/supercomp-property-decorator';
import "@mfelibs/base-css";
import Vue from "vue";
// import SignUp from "./../../index.js";

@Component({
    mixins:[sPageMixin] ,
    components: {
        // SignUp
    }
})
export default class App extends Vue{
    poster: string = 'https://ss1.baidu.com/9vo3dSag_xI4khGko9WTAnF6hhy/image/h%3D300/sign=0282c44e9c45d688bc02b4a494c37dab/4b90f603738da977f86d8b56be51f8198618e309.jpg';
}
</script>

<style>

</style>
