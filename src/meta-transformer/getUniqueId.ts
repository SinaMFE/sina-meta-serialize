import _ from "lodash/fp";

enum SCompDecoratorProperty {
  Version = "sversion",
  Name = "sname"
}

export function getIdOfPage(component: any) {
  return "placeholder";
}

export function getIdOfComponent(component: any) {
  return getParsedSComponentDecorator(component)[SCompDecoratorProperty.Name];
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
  return getParsedSComponentDecorator(component)[
    SCompDecoratorProperty.Version
  ];
}

function getParsedSComponentDecorator(component: any) {
  const decorator = getDecoratorByName(component.decorators, "SComponent");
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
      `Cannot get valid meta data for SComponent decorator of class:\n` +
        `See detail: \n ${JSON.stringify(component)}\n` +
        `Please check that you have installed and referenced dependencies correctly` +
        `and all referenced classes are decorated by "Scomponent"`
    );
  }
  return out;
}

function getDecoratorByName(decorators: any[], name: string) {
  return _.find(_.matches({ name }), decorators);
}
