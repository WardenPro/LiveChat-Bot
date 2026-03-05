// TODO(@livechat-maintainers, LC-TS-009): Replace temporary ambient typings with
// official type packages (@types/lodash, @types/mime-types) and remove this file.
declare module 'lodash' {
  export function startCase(value?: string): string;
}

declare module 'mime-types' {
  interface MimeTypes {
    lookup(path: string): string | false;
    extension(type: string): string | false;
  }

  const mimeTypes: MimeTypes;
  export default mimeTypes;
}
