import _ from "lodash/fp";

let phid = 0;

enum DecoratorPropertyKeyname {
  Version = "sversion",
  Name = "sname",
  Title = "stitle"
}

const COMP_ROOT_CLASS_DECO = "SComponent";

const PAGE_ROOT_CLASS_DECO = "SPage";

export function getCompTitle(component: any) {
  const decorator = getComponentDecoratorByName(
    component,
    COMP_ROOT_CLASS_DECO
  );

  return decorator[DecoratorPropertyKeyname.Title];
}

export function getPageTitle(component: any) {
  const deco = getComponentDecoratorByName(component, PAGE_ROOT_CLASS_DECO);

  return deco[DecoratorPropertyKeyname.Title];
}

export function getIdOfPage(component: any) {
  return "placeholder-$" + phid++;
}

export function getIdOfComponent(component: any) {
  const name = getComponentDecoratorByName(component, COMP_ROOT_CLASS_DECO)[
    DecoratorPropertyKeyname.Name
  ];
  if (!name) {
    throw new Error(
      `\nCannot get unique id from "SComponent" decorator from class declaration ${component}.\n` +
        `Please check that the serialization target is decorated by "SComponent" correctly, ` +
        `and the argument contains "${DecoratorPropertyKeyname.Name}" property.`
    );
  }
  return name;
}

/**
 * ?? Havenot implmented because is a runtime feature.
 * WARNING: In fact this function can't be impled.
 *
 * @param {*} component
 * @returns
 */
export function getVersionOfComponent(component: any) {
  // Meaningless.
  return getComponentDecoratorByName(component, COMP_ROOT_CLASS_DECO)[
    DecoratorPropertyKeyname.Version
  ];
}

function getComponentDecoratorByName(component: any, decName: string) {
  const decorator = getDecoratorByName(component.decorators, decName);
  let out;
  try {
    out = _.compose<any, any, any, any, any>(
      JSON.parse,
      _.property("value"),
      _.head,
      _.property("args")
    )(decorator);
  } catch (e) {
    throw new Error(
      `Cannot get valid meta data in ${decName} decorator of class:\n` +
        `See detail: \n ${JSON.stringify(component)}\n` +
        `\nPlease check that the serialization target is decorated by "${decName}" correctly\n`
    );
  }

  return out;
}

function getDecoratorByName(decorators: any[], name: string) {
  return _.find(_.matches({ name }), decorators);
}
