export type Role = 'admin'|'owner'|'student';
export interface User { id:number; name:string; email:string; phone?:string; role:Role }
export interface Property {
 id:number; owner_id:number; owner_name?:string; title:string; type:string; description:string;
 address:string; latitude:number; longitude:number; contact_phone:string; monthly_price:number;
 total_rooms:number; available_rooms:number; image_data?:string|null; status:string;
 average_rating:number; review_count:number; rejection_reason?:string;
}
export interface Booking {
 id:number; property_id:number; student_id:number; rooms:number; move_in_date:string; message?:string;
 status:string; confirmed_at?:string; property_title:string; address:string; monthly_price:number;
 student_name?:string; owner_name?:string;
}
export interface Notice { id:number; title:string; body:string; read_at?:string; created_at:string }
