import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "names", standalone: true })
export class NamesPipe implements PipeTransform {
  transform(items: Array<{ name: string }>): string {
    return items.map((item) => item.name).join(" y ");
  }
}
