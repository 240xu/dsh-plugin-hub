import shell, { apply, inject, listActiveRows, listDegraded } from "./shell.js";

export { apply, inject, listActiveRows, listDegraded };

export const name = "@240xu/dsh-plugin-hub";

export default { ...shell, name, inject, apply };
