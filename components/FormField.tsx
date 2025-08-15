
import { Controller, Control, FieldValues, Path, ControllerRenderProps } from "react-hook-form";

import {
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number"; // Added number type
  render?: ({ field }: { field: ControllerRenderProps<T, Path<T>> }) => React.ReactNode; // Added render prop
  min?: number; // Add min prop
  max?: number; // Add max prop
}

const FormField = <T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = "text",
  render, // Destructure render prop
  min, // Destructure min prop
  max, // Destructure max prop
}: FormFieldProps<T>) => {
  return (
    <Controller
      control={control}
      name={name}
      render={render || (({ field }) => ( // Use render prop if provided, else default to Input
        <FormItem>
          <FormLabel className="label">{label}</FormLabel>
          <FormControl>
            <Input
              className="input"
              type={type} // Ensure type is passed here
              placeholder={placeholder}
              {...field}
              min={min} // Pass min prop to Input
              max={max} // Pass max prop to Input
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      ))}
    />
  );
};

export default FormField;
