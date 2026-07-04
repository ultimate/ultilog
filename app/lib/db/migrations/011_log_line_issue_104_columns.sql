alter table log_lines rename column sea_state to waves;
alter table log_lines rename column magnetic_course to compass_course;
alter table log_lines rename column magnetic_course_corrected to magnetic_course;
alter table log_lines rename column drift_angle to wind_drift;
alter table log_lines add column weather_remark text not null default '';
alter table log_lines add column temperature real not null default 0;
alter table log_lines drop column course;
alter table log_lines drop column wind;
